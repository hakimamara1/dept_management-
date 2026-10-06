import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useLanguageStore } from '@/shared/i18n/useI18n'
import { restartApp } from '@/shared/lib/restart'
import { reconnect } from '../services/connectionManager'
import { useConnectionStore } from '../store'

/** Loads saved language + pairing, verifies the desktop is reachable, and re-verifies whenever the app returns to the foreground. */
export function useConnectionBootstrap() {
  const hydrateConnection = useConnectionStore((s) => s.hydrate)
  const hydrateLanguage = useLanguageStore((s) => s.hydrate)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // First launch (Arabic default) or a changed language: the layout direction only applies after a
      // reload, so reload once now rather than showing the first screen mirrored the wrong way.
      if (await hydrateLanguage()) {
        if (await restartApp()) return
      }
      await hydrateConnection()
      if (!cancelled && useConnectionStore.getState().connection) await reconnect()
    })()

    const sub = AppState.addEventListener('change', (state) => {
      const { status } = useConnectionStore.getState()
      if (state === 'active' && status !== 'unpaired' && status !== 'loading') reconnect()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [hydrateConnection, hydrateLanguage])
}
