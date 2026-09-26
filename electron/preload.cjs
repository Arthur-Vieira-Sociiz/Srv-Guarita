const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("guarita", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getLatestReading: () => ipcRenderer.invoke("reading:get-latest"),
});
