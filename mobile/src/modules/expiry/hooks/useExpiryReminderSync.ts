import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useI18n } from '@/shared/i18n/useI18n'
import { readJson, writeJson } from '@/shared/lib/secureJson'
import { useConnectionStore } from '@/modules/connection/store'
import { planReminders } from '../lib/reminders'
import { cancelExpiryReminders, ensureNotificationPermission, hasNotificationPermission, replaceExpiryReminders } from '../services/notifications'
import { useReminderStore } from '../store'
import { useExpiryBatches } from './useExpiry'

const ASKED_KEY = 'spice.notifPermissionAsked'

/**
 * Mounted once at the app root. Whenever the batch list is (re)loaded, the phone's scheduled reminders are rebuilt from it.
 * No server push exists (LAN only), so reminders reflect the data the phone last saw — that limit is stated in Settings.
 */
export function useExpiryReminderSync() {
  const { t, language } = useI18n()
  const router = useRouter()
  const status = useConnectionStore((s) => s.status)
  const enabled = useReminderStore((s) => s.enabled)
  const hydrate = useReminderStore((s) => s.hydrate)
  const batches = useExpiryBatches(status === 'connected' && enabled)

  useEffect(() => { hydrate() }, [hydrate])

  // Tapping a reminder opens the Expiry tab.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.push('/expiry'))
    return () => sub.remove()
  }, [router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!enabled) return void (await cancelExpiryReminders())
        if (!batches.data || cancelled) return
        const plan = planReminders(batches.data)
        if (plan.length === 0) return void (await cancelExpiryReminders())
        // Ask for permission once, the first time there is actually something to remind about — never on every launch.
        let granted = await hasNotificationPermission()
        if (!granted && !(await readJson<boolean>(ASKED_KEY))) {
          await writeJson(ASKED_KEY, true)
          granted = await ensureNotificationPermission()
        }
        if (!granted || cancelled) return
        const bodyFor = (r: (typeof plan)[number]) => {
          const key = r.offset >= 30 ? 'expiry.notify.d30' : r.offset >= 7 ? 'expiry.notify.d7' : 'expiry.notify.d1'
          return `${t(key).replace('{n}', String(r.count))}\n${r.names.join(' · ')}`
        }
        await replaceExpiryReminders(plan, t('expiry.notify.title'), t('expiry.reminders'), bodyFor)
      } catch {
        // Reminders are a convenience; a scheduling hiccup must never disturb the app.
      }
    })()
    return () => { cancelled = true }
    // `t` is a new function every render; the language is what actually changes the message text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches.data, enabled, language])
}
