export interface DiscoveredDesktop {
  host: string
  port: number
}

const isPrivateV4 = (a: string) =>
  /^10\./.test(a) || /^192\.168\./.test(a) || /^172\.(1[6-9]|2\d|3[01])\./.test(a)

/**
 * Finds desktops announcing `_spiceerp._tcp` over mDNS. The native module is only present in a
 * development/release build, not Expo Go — if it's missing we simply report nothing found and the
 * app falls back to the QR-saved addresses.
 */
export async function discoverDesktops(timeoutMs = 4000): Promise<DiscoveredDesktop[]> {
  let Zeroconf: any
  try {
    Zeroconf = require('react-native-zeroconf').default
  } catch {
    return []
  }

  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredDesktop>()
    let zeroconf: any
    try {
      zeroconf = new Zeroconf()
    } catch {
      resolve([])
      return
    }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      try {
        zeroconf.stop()
        zeroconf.removeDeviceListeners()
      } catch {
        /* module already torn down */
      }
      resolve([...found.values()])
    }

    zeroconf.on('resolved', (service: { port: number; addresses?: string[]; host?: string }) => {
      const address = (service.addresses ?? []).find(isPrivateV4)
      if (address && service.port) found.set(`${address}:${service.port}`, { host: address, port: service.port })
    })
    zeroconf.on('error', finish)

    try {
      zeroconf.scan('spiceerp', 'tcp', 'local.')
    } catch {
      finish()
      return
    }
    setTimeout(finish, timeoutMs)
  })
}
