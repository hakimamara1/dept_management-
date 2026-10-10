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

/**
 * A desktop is on the shop network, so its address is a private one (10.x, 172.16–31.x, 192.168.x, link-local) or an
 * mDNS name (*.local). Anything else — a public IP, a domain — in a QR or link is refused outright: it is the signature
 * of someone trying to make the phone talk to a server they control.
 */
export function isPrivateHost(host: string): boolean {
  const h = host.trim().toLowerCase()
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number)
    if ([a, b, c, d].some((n) => n > 255)) return false
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/.test(h)
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
    parsed.port >= 1 && parsed.port <= 65535 &&
    Array.isArray(parsed.hosts) && parsed.hosts.length > 0 && parsed.hosts.length <= 8 &&
    parsed.hosts.every((h: unknown) => typeof h === 'string' && isPrivateHost(h))
  if (!ok) throw new PairingError('invalid', 'invalid-qr')
  return { ...parsed, name: typeof parsed.name === 'string' ? parsed.name.slice(0, 80) : '' } as PairPayload
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
