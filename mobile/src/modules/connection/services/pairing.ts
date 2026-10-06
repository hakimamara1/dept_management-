import { useConnectionStore, type SavedConnection } from '../store'

export interface PairPayload {
  app: 'spice-erp'
  v: number
  name: string
  port: number
  hosts: string[]
  code: string
}

export class PairingError extends Error {
  kind: 'invalid-qr' | 'rejected' | 'unreachable'
  constructor(message: string, kind: PairingError['kind']) {
    super(message)
    this.kind = kind
  }
}

/** Accepts the desktop's `spiceerp://pair?d=<json>` link (QR / deep link) or the bare JSON it wraps. */
export function parsePairPayload(data: string): PairPayload {
  let parsed: any
  try {
    const text = data.trim()
    if (text.startsWith('spiceerp://')) {
      const encoded = text.split('?d=')[1]
      if (!encoded) throw new Error('no payload')
      parsed = JSON.parse(decodeURIComponent(encoded))
    } else {
      parsed = JSON.parse(text)
    }
  } catch {
    throw new PairingError('invalid', 'invalid-qr')
  }
  const ok =
    parsed?.app === 'spice-erp' &&
    typeof parsed.code === 'string' && parsed.code.length >= 8 &&
    Number.isInteger(parsed.port) &&
    Array.isArray(parsed.hosts) && parsed.hosts.length > 0 && parsed.hosts.every((h: unknown) => typeof h === 'string')
  if (!ok) throw new PairingError('invalid', 'invalid-qr')
  return parsed as PairPayload
}

async function postPair(host: string, payload: PairPayload, deviceName: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    return await fetch(`http://${host}:${payload.port}/api/mobile/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: payload.code, deviceName }),
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The QR lists every LAN address of the desktop (Wi-Fi, Ethernet…). Try them in order and move on only
 * when an address is *unreachable*: any real answer from the server (even a rejection) is final, because
 * retrying elsewhere would waste one of the code's 5 allowed attempts.
 */
export async function pairWithDesktop(payload: PairPayload, deviceName: string): Promise<SavedConnection> {
  for (const host of payload.hosts) {
    let res: Response
    try {
      res = await postPair(host, payload, deviceName)
    } catch {
      continue
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new PairingError((data && data.error) || `HTTP ${res.status}`, 'rejected')

    const connection: SavedConnection = {
      hosts: payload.hosts,
      lastHost: host,
      port: payload.port,
      token: data.token,
      desktopName: data.desktopName ?? payload.name,
      deviceId: data.deviceId
    }
    await useConnectionStore.getState().setConnection(connection)
    return connection
  }
  throw new PairingError('unreachable', 'unreachable')
}
