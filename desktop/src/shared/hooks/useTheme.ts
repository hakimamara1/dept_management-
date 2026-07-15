import { useEffect, useState } from 'react'
import { useUiStore } from '@shared/store/ui-store'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Resolves the stored theme preference ('light' | 'dark' | 'system') into
 * an actual 'light' | 'dark' value, tracks OS changes when on 'system', and
 * keeps the <html class="dark"> toggle in sync — Tailwind v4's `.dark`
 * selector is what every component's dark-mode tokens key off.
 */
export function useTheme() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme)
      return
    }

    setResolvedTheme(getSystemTheme())
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(getSystemTheme())
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  return { theme, resolvedTheme, setTheme }
}
