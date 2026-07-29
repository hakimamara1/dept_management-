import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { startBackend, stopBackend, waitForBackendHealth } from './backend-process'

// Two Electron instances would each spawn their own backend child process
// against the exact same invoices.db — WAL mode tolerates multiple writers,
// but a backup taken from outside has no way to know a second, invisible
// instance is mid-write, which reproduces the "copied all three files, still
// got wrong data" symptom independent of the shutdown-checkpoint bug fixed
// below. Refuse to launch a second instance instead of allowing that.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    win.loadURL(devServerUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  async function launch(): Promise<void> {
    startBackend()
    try {
      await waitForBackendHealth()
    } catch (err) {
      console.error('[main] backend failed to start:', err)
    }
    createWindow()
  }

  app.whenReady().then(async () => {
    await launch()

    app.on('activate', () => {
      // On macOS, window-all-closed below stops the backend but keeps the
      // app alive — reactivating via the dock previously only recreated the
      // window and left it talking to a dead backend. startBackend() is a
      // no-op if a process is already running, so re-launching here is safe
      // in every case, not just this one.
      if (BrowserWindow.getAllWindows().length === 0) launch()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    } else {
      stopBackend()
    }
  })

  // before-quit fires synchronously, but stopping the backend is now an
  // awaited handshake (see stopBackend) — preventDefault() to hold the quit,
  // run the async stop, then quit again. The second app.quit() re-enters
  // this same handler, so isQuitting guards against re-preventing it and
  // looping forever.
  let isQuitting = false
  app.on('before-quit', (event) => {
    if (isQuitting) return
    event.preventDefault()
    isQuitting = true
    stopBackend().finally(() => app.quit())
  })
}
