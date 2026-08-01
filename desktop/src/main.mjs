import { app, BrowserWindow, Menu, Tray, session, shell } from "electron";
import electronUpdater from "electron-updater";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { autoUpdater } = electronUpdater;

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOTALK_URL = process.env.TOTALK_URL?.trim() || "https://totalker.ru/";
const TOTALK_ORIGIN = new URL(TOTALK_URL).origin;
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");

app.setName("ToTalk");
app.setAppUserModelId("com.totalk.desktop");

// Closing the window minimizes to the tray instead of quitting, so an
// active call or new-message polling keeps running in the background —
// only the tray menu's "Выйти" (or Cmd/Ctrl+Q) actually exits the app.
let isQuitting = false;
let tray = null;

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

function createWindow() {
  const window = new BrowserWindow({
    title: "ToTalk",
    width: 1320,
    height: 820,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: "#111216",
    show: false,
    autoHideMenuBar: process.platform !== "darwin",
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      devTools: false,
      backgroundThrottling: false
    }
  });

  window.once("ready-to-show", () => window.show());

  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

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
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
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

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "media" && new URL(requestingOrigin).origin === TOTALK_ORIGIN;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const sameOrigin = webContents.getURL().startsWith(TOTALK_ORIGIN);
    callback(permission === "media" && sameOrigin);
  });
  createMenu();
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
