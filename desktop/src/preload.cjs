/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("totalkDesktop", {
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  toggleFullscreenWindow: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  isWindowFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  showNotification: (payload) => ipcRenderer.invoke("notification:show", payload),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event, maximized) => callback(maximized);
    ipcRenderer.on("window:maximized-changed", listener);
    return () => ipcRenderer.removeListener("window:maximized-changed", listener);
  },
  onWindowFullscreenChange: (callback) => {
    const listener = (_event, fullscreen) => callback(fullscreen);
    ipcRenderer.on("window:fullscreen-changed", listener);
    return () => ipcRenderer.removeListener("window:fullscreen-changed", listener);
  },
});
