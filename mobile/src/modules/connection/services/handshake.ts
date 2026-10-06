export const SUPPORTED_API_VERSION = 1

export interface Handshake {
  app: string
  apiVersion: number
  appVersion: string
  desktopName: string
  deviceId: number
  deviceName: string
}

export type HandshakeResult =
  | { ok: true; data: Handshake }
  | { ok: false; reason: 'network' | 'unauthorized' | 'invalid' }

/** Talks to one specific address without touching the connection store — used to probe candidates. */
export async function fetchHandshake(host: string, port: number, token: string, timeoutMs = 4000): Promise<HandshakeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`http://${host}:${port}/api/mobile/handshake`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (!res.ok) return { ok: false, reason: 'invalid' }
    const data = (await res.json()) as Handshake
    if (data.app !== 'spice-erp') return { ok: false, reason: 'invalid' }
    return { ok: true, data }
  } catch {
    return { ok: false, reason: 'network' }
  } finally {
    clearTimeout(timer)
  }
}
