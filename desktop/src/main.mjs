import { app, BrowserWindow, Menu, session, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOTALK_URL = process.env.TOTALK_URL?.trim() || "https://totalker.ru/";
const TOTALK_ORIGIN = new URL(TOTALK_URL).origin;

app.setName("ToTalk");
app.setAppUserModelId("com.totalk.desktop");

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
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      devTools: false
    }
  });

  window.once("ready-to-show", () => window.show());

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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
