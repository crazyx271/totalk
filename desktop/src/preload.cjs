/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("totalkDesktop", {
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  showNotification: (payload) => ipcRenderer.invoke("notification:show", payload),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event, maximized) => callback(maximized);
    ipcRenderer.on("window:maximized-changed", listener);
    return () => ipcRenderer.removeListener("window:maximized-changed", listener);
  },
});
