import { Platform } from 'react-native'
import type { PlannedReminder } from '../lib/reminders'

type NotificationsModule = typeof import('expo-notifications')

/**
 * expo-notifications throws the moment it is imported inside Expo Go (Android push support was removed from it),
 * and a static import would take the whole app down with it. It is therefore loaded defensively: where it is not
 * available (Expo Go) reminders are simply off and every other screen works; the installed app / dev build has it.
 */
let Notifications: NotificationsModule | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications') as NotificationsModule
  // Show reminders even while the app is open (the person may be in another tab).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
  })
} catch {
  Notifications = null
}

const CHANNEL = 'expiry'
const PREFIX = 'expiry-'

/** false in Expo Go — the Settings switch is hidden there and no scheduling is attempted. */
export const remindersSupported = Notifications != null

/** true when notifications are allowed; asks once if the system has not been asked yet. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false
  return (await Notifications.getPermissionsAsync()).granted
}

async function ensureChannel(name: string) {
  if (!Notifications || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL, { name, importance: Notifications.AndroidImportance.HIGH })
}

export async function cancelExpiryReminders() {
  if (!Notifications) return
  const N = Notifications
  const pending = await N.getAllScheduledNotificationsAsync()
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => N.cancelScheduledNotificationAsync(n.identifier)))
}

/**
 * Replaces every scheduled expiry reminder with `plan` (same identifiers → no duplicates, and
 * reminders for batches that were since sold/deleted simply disappear).
 */
export async function replaceExpiryReminders(plan: PlannedReminder[], title: string, channelName: string, bodyFor: (r: PlannedReminder) => string) {
  if (!Notifications) return
  await ensureChannel(channelName)
  await cancelExpiryReminders()
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title, body: bodyFor(r), data: { screen: 'expiry' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL }
    })
  }
}

/** Calls `onTap` when the person taps a reminder; returns the unsubscribe function (a no-op where unsupported). */
export function onReminderTapped(onTap: () => void): () => void {
  if (!Notifications) return () => {}
  const sub = Notifications.addNotificationResponseReceivedListener(() => onTap())
  return () => sub.remove()
}
