import { contextBridge } from 'electron'

/**
 * Deliberately minimal — the renderer talks to the backend over plain HTTP
 * (TanStack Query -> http://127.0.0.1:3000), so there is no need to expose
 * Node/IPC surface for data access. This bridge only carries what the UI
 * chrome needs (e.g. app version for an "About" panel later).
 */
const api = {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
} as const

contextBridge.exposeInMainWorld('desktop', api)

export type DesktopApi = typeof api
