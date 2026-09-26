const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store").default;
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

const API_KEY = "123456ABCDEF";

const store = new Store({
  name: "guarita-settings",
  defaults: {
    serverUrl: "http://localhost:80",
    cameraId: "",
  },
});

let mainWindow;

function getEndpoint(serverUrl) {
  const normalized = serverUrl.replace(/\/$/, "");
  return /\/PostSend$/i.test(normalized) ? normalized : `${normalized}/PostSend`;
}

async function getLatestReading() {
  const { serverUrl, cameraId } = store.store;
  if (!cameraId) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(getEndpoint(serverUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: API_KEY,
        action: "ultima_leitura_camera",
        leituraCamera: { idDispositivo: cameraId },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Servidor retornou HTTP ${response.status}.`);
    const payload = await response.json();
    return payload?.sucesso && payload?.leituraCamera ? payload.leituraCamera : null;
  } finally {
    clearTimeout(timeout);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    log.error("[AutoUpdate] Falha ao verificar atualização:", error);
  });

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Atualização disponível",
        message: `A versão ${info.version} foi baixada e está pronta para instalar.`,
        detail: "Reinicie agora para aplicar a atualização ou feche o aplicativo mais tarde.",
        buttons: ["Reiniciar agora", "Mais tarde"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 10_000);
  setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: "#071827",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("settings:get", () => store.store);
  ipcMain.handle("settings:save", (_event, value) => {
    const serverUrl = String(value?.serverUrl || "").trim().replace(/\/$/, "");
    const cameraId = String(value?.cameraId || "").trim();

    if (!/^https?:\/\/[^\s]+$/i.test(serverUrl)) {
      throw new Error("Informe uma URL de servidor válida, começando com http:// ou https://.");
    }
    store.set({ serverUrl, cameraId });
    return store.store;
  });
  ipcMain.handle("reading:get-latest", () => getLatestReading());

  createWindow();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
