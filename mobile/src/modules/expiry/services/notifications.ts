import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { PlannedReminder } from '../lib/reminders'

const CHANNEL = 'expiry'
const PREFIX = 'expiry-'

// Show reminders even while the app is open (the person may be in another tab).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
})

/** true when notifications are allowed; asks once if the system has not been asked yet. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted
}

async function ensureChannel(name: string) {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL, { name, importance: Notifications.AndroidImportance.HIGH })
}

export async function cancelExpiryReminders() {
  const pending = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)))
}

/**
 * Replaces every scheduled expiry reminder with `plan` (same identifiers → no duplicates, and
 * reminders for batches that were since sold/deleted simply disappear).
 */
export async function replaceExpiryReminders(plan: PlannedReminder[], title: string, channelName: string, bodyFor: (r: PlannedReminder) => string) {
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
