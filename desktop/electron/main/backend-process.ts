import { ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Dev-mode spawns the existing Express + better-sqlite3 backend with the
 * system `node` binary against the repo's own `src/app.js` — no native-
 * module ABI concern in dev, since the developer's own `npm install`
 * already built better-sqlite3 for that same system Node.
 *
 * Packaged builds are different on every count:
 *  - There's no guarantee the end user has Node.js installed at all, so we
 *    run the backend on Electron's own bundled Node via
 *    `ELECTRON_RUN_AS_NODE=1` + `process.execPath` instead of a bare `node`.
 *  - The backend's `src/` + its `node_modules` (including better-sqlite3,
 *    rebuilt for Electron's ABI via `@electron/rebuild` — see
 *    `package.json`'s `rebuild:native` script) are copied into
 *    `resources/backend/` by electron-builder's `extraResources`, so the
 *    entry path is resolved from `process.resourcesPath`, not a path
 *    relative to this repo's folder layout.
 *  - The app bundle itself is read-only at runtime, so writable data
 *    (database, uploads, .env) must live outside it — `APP_DATA_DIR` tells
 *    `src/config/paths.js` to use Electron's per-user `userData` directory
 *    instead of its repo-relative default. See docs/packaging.md.
 */

const BACKEND_PORT = 3000
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`
const HEALTH_TIMEOUT_MS = 15_000
const HEALTH_POLL_INTERVAL_MS = 250
// Must exceed src/app.js's own 5s forced-exit timeout, or we'd SIGKILL the
// backend mid-checkpoint instead of letting its own safety net finish first.
const SHUTDOWN_TIMEOUT_MS = 8_000

let backendProcess: ChildProcess | null = null

function backendEntryPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend/app.js')
  }
  // desktop/electron/main -> ../../../src/app.js (repo root's Express app)
  return join(__dirname, '../../../src/app.js')
}

export function startBackend(): ChildProcess {
  if (backendProcess) return backendProcess

  const execPath = app.isPackaged ? process.execPath : 'node'
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    ...(app.isPackaged && {
      ELECTRON_RUN_AS_NODE: '1',
      APP_DATA_DIR: app.getPath('userData')
    })
  }

  backendProcess = spawn(execPath, [backendEntryPath()], { stdio: 'inherit', env })

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
    backendProcess = null
  })

  return backendProcess
}

/**
 * Sends SIGTERM and waits for the child to actually exit before resolving.
 * `ChildProcess.kill()` is fire-and-forget — the original code called it and
 * moved on immediately, so Electron's own quit sequence could finish (and on
 * Windows, an auto-updater could start rewriting files) before the backend's
 * SIGTERM handler had even run, let alone finished its WAL checkpoint. This
 * turns shutdown into a real handshake: wait for 'exit', and escalate to
 * SIGKILL only if the graceful path hangs past SHUTDOWN_TIMEOUT_MS.
 */
export function stopBackend(): Promise<void> {
  const proc = backendProcess
  if (!proc) return Promise.resolve()

  return new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      console.warn('[backend] did not exit within timeout, sending SIGKILL')
      proc.kill('SIGKILL')
    }, SHUTDOWN_TIMEOUT_MS)

    proc.once('exit', () => {
      clearTimeout(killTimer)
      resolve()
    })

    proc.kill('SIGTERM')
  })
}

export async function waitForBackendHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL)
      if (res.ok) return
    } catch {
      // backend not up yet — keep polling
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS))
  }

  throw new Error(`Backend did not become healthy within ${HEALTH_TIMEOUT_MS}ms`)
}
