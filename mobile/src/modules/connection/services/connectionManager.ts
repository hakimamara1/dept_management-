import { useConnectionStore, type ConnectionStatus } from '../store'
import { discoverDesktops } from './discovery'
import { fetchHandshake, SUPPORTED_API_VERSION, type HandshakeResult } from './handshake'

let running: Promise<ConnectionStatus> | null = null

function statusFor(result: HandshakeResult): ConnectionStatus | null {
  if (result.ok) return result.data.apiVersion === SUPPORTED_API_VERSION ? 'connected' : 'incompatible'
  return result.reason === 'unauthorized' ? 'unauthorized' : null
}

async function establish(): Promise<ConnectionStatus> {
  const store = useConnectionStore.getState()
  const saved = store.connection
  if (!saved) return 'unpaired'

  // 1. Known addresses first (last one that worked, then the rest from the QR).
  for (const host of [saved.lastHost, ...saved.hosts.filter((h) => h !== saved.lastHost)]) {
    const result = await fetchHandshake(host, saved.port, saved.token)
    const status = statusFor(result)
    if (status === 'connected' && host !== saved.lastHost) await store.updateAddress(host, saved.port)
    if (status) return status
  }

  // 2. The desktop's IP/port may have changed (DHCP, port fallback) — look for it on the network.
  for (const candidate of await discoverDesktops()) {
    const result = await fetchHandshake(candidate.host, candidate.port, saved.token)
    const status = statusFor(result)
    // 'unauthorized' here just means a *different* desktop answered; keep looking.
    if (status === 'connected') {
      await store.updateAddress(candidate.host, candidate.port)
      return 'connected'
    }
    if (status === 'incompatible') return status
  }
  return 'unreachable'
}

/** Probes the saved desktop (then mDNS) and publishes the outcome to the connection store. Concurrent calls share one run. */
export function reconnect(): Promise<ConnectionStatus> {
  if (!running) {
    useConnectionStore.getState().setStatus('connecting')
    running = establish()
      .then((status) => {
        useConnectionStore.getState().setStatus(status)
        return status
      })
      .finally(() => {
        running = null
      })
  }
  return running
}
