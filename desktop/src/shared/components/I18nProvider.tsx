import { useEffect, useMemo, type ReactNode } from 'react'
import { useUiStore } from '@shared/store/ui-store'
import { I18nContext, rtlLanguages, translate, type TranslationKey } from '@shared/lib/i18n'

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useUiStore((s) => s.language)
  const dir = rtlLanguages.includes(language) ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language, dir])

  const value = useMemo(
    () => ({
      language,
      dir: dir as 'rtl' | 'ltr',
      t: (key: TranslationKey) => translate(language, key)
    }),
    [language, dir]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
