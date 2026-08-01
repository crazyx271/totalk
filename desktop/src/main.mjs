import { app, BrowserWindow, Menu, Tray, Notification, desktopCapturer, ipcMain, session, shell } from "electron";
import electronUpdater from "electron-updater";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { autoUpdater } = electronUpdater;

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOTALK_URL = process.env.TOTALK_URL?.trim() || "https://totalker.ru/";
const TOTALK_ORIGIN = new URL(TOTALK_URL).origin;
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

app.setName("ToTalk");
app.setAppUserModelId("com.totalk.desktop");

// Closing the window minimizes to the tray instead of quitting, so an
// active call or new-message polling keeps running in the background —
// only the tray menu's "Выйти" (or Cmd/Ctrl+Q) actually exits the app.
let isQuitting = false;
let tray = null;
let mainWindow = null;
let splashWindow = null;

// Without this, launching the app while an older/updated copy is already
// sitting in the tray spawns a second process — its window can end up
// stacked directly on top of the first, e.g. showing the old version's
// native-framed window right behind the new frameless one. A second
// launch now just focuses the existing window instead of starting a
// competing instance.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on("second-instance", () => showMainWindow());

function createMenu() {
  const template = [
    {
      label: "ToTalk",
      submenu: [
        { label: "Перезагрузить", role: "reload" },
        { type: "separator" },
        { label: "Выйти", role: "quit" }
      ]
    },
    {
      label: "Правка",
      submenu: [
        { label: "Отменить", role: "undo" },
        { label: "Повторить", role: "redo" },
        { type: "separator" },
        { label: "Вырезать", role: "cut" },
        { label: "Копировать", role: "copy" },
        { label: "Вставить", role: "paste" },
        { label: "Выбрать всё", role: "selectAll" }
      ]
    },
    {
      label: "Окно",
      submenu: [
        { label: "Свернуть", role: "minimize" },
        { label: "Закрыть", role: "close" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 360,
    height: 420,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: "#111216",
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  splash.once("ready-to-show", () => splash.show());
  void splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

function createWindow() {
  const window = new BrowserWindow({
    title: "ToTalk",
    width: 1320,
    height: 820,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: "#111216",
    show: false,
    frame: false,
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      devTools: false,
      backgroundThrottling: false,
      preload: PRELOAD_PATH
    }
  });

  window.once("ready-to-show", () => {
    window.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
  });

  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

  window.on("maximize", () => window.webContents.send("window:maximized-changed", true));
  window.on("unmaximize", () => window.webContents.send("window:maximized-changed", false));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin === TOTALK_ORIGIN) {
      window.loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== TOTALK_ORIGIN) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  window.webContents.on("did-fail-load", (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      void window.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  void window.loadURL(TOTALK_URL);
  return window;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(ICON_PATH);
  tray.setToolTip("ToTalk");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Открыть ToTalk", click: showMainWindow },
    { type: "separator" },
    {
      label: "Выйти", click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("click", showMainWindow);
}

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.handle("notification:show", (_event, payload = {}) => {
  if (!Notification.isSupported()) return false;
  const title = typeof payload.title === "string" ? payload.title.slice(0, 120) : "ToTalk";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 500) : "Новое сообщение";
  const notification = new Notification({ title, body, icon: ICON_PATH, silent: true });
  notification.on("click", showMainWindow);
  notification.show();
  return true;
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const allowed = new Set(["media", "fullscreen", "notifications"]);
    try {
      return allowed.has(permission) && new URL(requestingOrigin).origin === TOTALK_ORIGIN;
    } catch {
      return false;
    }
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const sameOrigin = webContents.getURL().startsWith(TOTALK_ORIGIN);
    callback(["media", "fullscreen", "notifications"].includes(permission) && sameOrigin);
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (!request.frame?.url.startsWith(TOTALK_ORIGIN)) return callback({});
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });
      const source = sources.find((item) => item.id.startsWith("screen:")) ?? sources[0];
      callback(source ? { video: source } : {});
    } catch {
      callback({});
    }
  }, { useSystemPicker: true });
  createMenu();
  splashWindow = createSplashWindow();
  mainWindow = createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    else showMainWindow();
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), UPDATE_CHECK_INTERVAL_MS);
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
