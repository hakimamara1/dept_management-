"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_child_process = require("node:child_process");
const BACKEND_PORT = 3e3;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;
const HEALTH_TIMEOUT_MS = 15e3;
const HEALTH_POLL_INTERVAL_MS = 250;
let backendProcess = null;
function backendEntryPath() {
  return node_path.join(__dirname, "../../../src/app.js");
}
function startBackend() {
  if (backendProcess) return backendProcess;
  backendProcess = node_child_process.spawn("node", [backendEntryPath()], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(BACKEND_PORT) }
  });
  backendProcess.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });
  return backendProcess;
}
function stopBackend() {
  backendProcess?.kill();
  backendProcess = null;
}
async function waitForBackendHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch {
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  throw new Error(`Backend did not become healthy within ${HEALTH_TIMEOUT_MS}ms`);
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!electron.app.isPackaged && devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
electron.app.whenReady().then(async () => {
  startBackend();
  try {
    await waitForBackendHealth();
  } catch (err) {
    console.error("[main] backend failed to start:", err);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  stopBackend();
});
