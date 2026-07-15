import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'
export type AppLanguage = 'ar' | 'fr' | 'en'

interface UiState {
  sidebarCollapsed: boolean
  theme: ThemePreference
  language: AppLanguage
  toggleSidebar: () => void
  setTheme: (theme: ThemePreference) => void
  setLanguage: (language: AppLanguage) => void
}

/**
 * Pure UI state only (sidebar, theme, language). Server data lives in
 * TanStack Query, form state lives in react-hook-form — this store never
 * holds either, per the three-state-types rule in the architecture brief.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      language: 'ar',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language })
    }),
    { name: 'ui-preferences' }
  )
)
