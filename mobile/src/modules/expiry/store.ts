import { create } from 'zustand'
import { readJson, writeJson } from '@/shared/lib/secureJson'

const KEY = 'spice.expiryReminders'

interface ReminderState {
  /** User preference: schedule phone reminders for upcoming expiries. On by default. */
  enabled: boolean
  hydrated: boolean
  hydrate: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

export const useReminderStore = create<ReminderState>((set) => ({
  enabled: true,
  hydrated: false,
  hydrate: async () => {
    const saved = await readJson<boolean>(KEY)
    set({ enabled: saved ?? true, hydrated: true })
  },
  setEnabled: async (enabled) => {
    set({ enabled })
    await writeJson(KEY, enabled)
  }
}))
