"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_child_process = require("node:child_process");
const BACKEND_PORT = 3e3;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;
const HEALTH_TIMEOUT_MS = 15e3;
const HEALTH_POLL_INTERVAL_MS = 250;
const SHUTDOWN_TIMEOUT_MS = 8e3;
let backendProcess = null;
function backendEntryPath() {
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "backend/app.js");
  }
  return node_path.join(__dirname, "../../../src/app.js");
}
function startBackend() {
  if (backendProcess) return backendProcess;
  const execPath = electron.app.isPackaged ? process.execPath : "node";
  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    ...electron.app.isPackaged && {
      ELECTRON_RUN_AS_NODE: "1",
      APP_DATA_DIR: electron.app.getPath("userData")
    }
  };
  backendProcess = node_child_process.spawn(execPath, [backendEntryPath()], { stdio: "inherit", env });
  backendProcess.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });
  return backendProcess;
}
function stopBackend() {
  const proc = backendProcess;
  if (!proc) return Promise.resolve();
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      console.warn("[backend] did not exit within timeout, sending SIGKILL");
      proc.kill("SIGKILL");
    }, SHUTDOWN_TIMEOUT_MS);
    proc.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    proc.kill("SIGTERM");
  });
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
const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  electron.app.quit();
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
if (gotSingleInstanceLock) {
  electron.app.on("second-instance", () => {
    const [win] = electron.BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  async function launch() {
    startBackend();
    try {
      await waitForBackendHealth();
    } catch (err) {
      console.error("[main] backend failed to start:", err);
    }
    createWindow();
  }
  electron.app.whenReady().then(async () => {
    await launch();
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) launch();
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    } else {
      stopBackend();
    }
  });
  let isQuitting = false;
  electron.app.on("before-quit", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    stopBackend().finally(() => electron.app.quit());
  });
}
