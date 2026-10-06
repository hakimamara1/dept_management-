import { I18nManager } from 'react-native'
import { create } from 'zustand'
import { readJson, writeJson } from '@/shared/lib/secureJson'
import { dictionaries, type Language, type TranslationKey } from './dictionaries'

const STORAGE_KEY = 'spice.language'

interface LanguageState {
  language: Language
  hydrated: boolean
  /** Resolves true when the saved language needs a different layout direction and a reload is required. */
  hydrate: () => Promise<boolean>
  /** Returns true when the layout direction changed and the app must restart to apply it. */
  setLanguage: (language: Language) => Promise<boolean>
}

const wantsRtl = (language: Language) => language === 'ar'

/** RN only applies a direction change on the next launch. */
function syncDirection(language: Language): boolean {
  I18nManager.allowRTL(true)
  if (I18nManager.isRTL === wantsRtl(language)) return false
  I18nManager.forceRTL(wantsRtl(language))
  return true
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ar',
  hydrated: false,
  hydrate: async () => {
    const saved = await readJson<Language>(STORAGE_KEY)
    const language = saved && saved in dictionaries ? saved : 'ar' // Arabic by default, like the desktop
    set({ language, hydrated: true })
    return syncDirection(language)
  },
  setLanguage: async (language) => {
    await writeJson(STORAGE_KEY, language)
    set({ language })
    return syncDirection(language)
  }
}))

export function useI18n() {
  const language = useLanguageStore((s) => s.language)
  const dict = dictionaries[language]
  return {
    language,
    isRTL: wantsRtl(language),
    t: (key: TranslationKey) => dict[key]
  }
}
