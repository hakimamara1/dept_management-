import { ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'

/**
 * Dev-mode spawns the existing Express + better-sqlite3 backend with the
 * system `node` binary — it already runs that way today and there's no
 * native-module ABI concern in dev.
 *
 * Packaged builds need `better-sqlite3` rebuilt against Electron's Node ABI
 * (via `@electron/rebuild`) and the child launched with
 * `ELECTRON_RUN_AS_NODE=1` using `process.execPath` instead of depending on
 * a system Node install. That is a documented follow-up for the packaging
 * phase, not solved here.
 */

const BACKEND_PORT = 3000
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`
const HEALTH_TIMEOUT_MS = 15_000
const HEALTH_POLL_INTERVAL_MS = 250

let backendProcess: ChildProcess | null = null

function backendEntryPath(): string {
  // desktop/electron/main -> ../../../src/app.js (repo root's Express app)
  return join(__dirname, '../../../src/app.js')
}

export function startBackend(): ChildProcess {
  if (backendProcess) return backendProcess

  backendProcess = spawn('node', [backendEntryPath()], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(BACKEND_PORT) }
  })

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
    backendProcess = null
  })

  return backendProcess
}

export function stopBackend(): void {
  backendProcess?.kill()
  backendProcess = null
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
