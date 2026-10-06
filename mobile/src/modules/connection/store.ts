import { create } from 'zustand'
import { readJson, removeKey, writeJson } from '@/shared/lib/secureJson'

const STORAGE_KEY = 'spice.connection'

/** Everything needed to talk to the paired desktop. The token is a secret — it only ever lives in SecureStore. */
export interface SavedConnection {
  /** Every LAN address the desktop advertised when pairing (it can have several adapters). */
  hosts: string[]
  /** The address that last answered. */
  lastHost: string
  port: number
  token: string
  desktopName: string
  deviceId: number
}

export type ConnectionStatus =
  | 'loading' // reading SecureStore
  | 'unpaired' // never paired (or unpaired)
  | 'connecting'
  | 'connected'
  | 'unreachable' // desktop off / different network
  | 'unauthorized' // desktop revoked this phone
  | 'incompatible' // API version mismatch

interface ConnectionState {
  status: ConnectionStatus
  connection: SavedConnection | null
  hydrate: () => Promise<void>
  setConnection: (connection: SavedConnection) => Promise<void>
  setStatus: (status: ConnectionStatus) => void
  /** Remember a new working address/port (after discovery) without re-pairing. */
  updateAddress: (host: string, port: number) => Promise<void>
  clear: () => Promise<void>
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'loading',
  connection: null,
  hydrate: async () => {
    const saved = await readJson<SavedConnection>(STORAGE_KEY)
    set(saved ? { connection: saved, status: 'connecting' } : { connection: null, status: 'unpaired' })
  },
  setConnection: async (connection) => {
    await writeJson(STORAGE_KEY, connection)
    set({ connection, status: 'connected' })
  },
  setStatus: (status) => set({ status }),
  updateAddress: async (host, port) => {
    const current = get().connection
    if (!current) return
    const hosts = current.hosts.includes(host) ? current.hosts : [...current.hosts, host]
    const next = { ...current, hosts, lastHost: host, port }
    await writeJson(STORAGE_KEY, next)
    set({ connection: next })
  },
  clear: async () => {
    await removeKey(STORAGE_KEY)
    set({ connection: null, status: 'unpaired' })
  }
}))
