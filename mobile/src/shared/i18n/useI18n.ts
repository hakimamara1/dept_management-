import { I18nManager } from 'react-native'
import { create } from 'zustand'
import { setFormatLanguage } from '@/shared/lib/format'
import { readJson, removeKey, writeJson } from '@/shared/lib/secureJson'
import { dictionaries, type Language, type TranslationKey } from './dictionaries'

const STORAGE_KEY = 'spice.language'
const RESTART_KEY = 'spice.rtlRestartFor'

interface LanguageState {
  language: Language
  hydrated: boolean
  /** Resolves true when the saved language needs a different layout direction and a reload is required. */
  hydrate: () => Promise<boolean>
  /** Returns true when the layout direction changed and the app must restart to apply it. */
  setLanguage: (language: Language) => Promise<boolean>
}

const wantsRtl = (language: Language) => language === 'ar'

/**
 * RN only applies a direction change on the next native launch. A restart is requested at most once per target
 * direction: where the host can't make it stick (Expo Go reloads JS but keeps its own direction) we would
 * otherwise reload forever. The attempt is remembered across reloads and forgotten once the direction matches.
 */
async function syncDirection(language: Language): Promise<boolean> {
  const rtl = wantsRtl(language)
  I18nManager.allowRTL(true)
  if (I18nManager.isRTL === rtl) {
    await removeKey(RESTART_KEY).catch(() => {})
    return false
  }
  I18nManager.forceRTL(rtl)
  if ((await readJson<boolean>(RESTART_KEY)) === rtl) return false // already restarted for this; don't loop
  await writeJson(RESTART_KEY, rtl).catch(() => {})
  return true
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ar',
  hydrated: false,
  hydrate: async () => {
    const saved = await readJson<Language>(STORAGE_KEY)
    const language = saved && saved in dictionaries ? saved : 'ar' // Arabic by default, like the desktop
    setFormatLanguage(language)
    set({ language, hydrated: true })
    return syncDirection(language)
  },
  setLanguage: async (language) => {
    await writeJson(STORAGE_KEY, language)
    setFormatLanguage(language)
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
