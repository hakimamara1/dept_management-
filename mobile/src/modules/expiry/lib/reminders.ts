import type { ExpirationBatch } from '@desktop-types/api'
import { addDays, parseISODate } from '@/shared/lib/dates'
import { isClosed } from './urgency'

export const REMINDER_OFFSETS = [30, 7, 1] as const
export const REMINDER_HOUR = 9
/** Android and iOS both cope badly with hundreds of pending local alarms; the nearest ones are what matter. */
export const MAX_REMINDERS = 48

export interface PlannedReminder {
  /** Stable per (trigger day, offset) so re-planning replaces instead of piling up. */
  identifier: string
  at: Date
  offset: number
  count: number
  /** Up to three product names, for the message body. */
  names: string[]
}

/**
 * Pure planner: one reminder per (day, offset) that lists how many batches are affected — never one per batch,
 * so a big catalogue produces a handful of notifications, not hundreds.
 */
export function planReminders(batches: ExpirationBatch[], now = new Date(), offsets: readonly number[] = REMINDER_OFFSETS): PlannedReminder[] {
  const groups = new Map<string, PlannedReminder>()
  for (const batch of batches) {
    if (isClosed(batch)) continue
    const expiry = parseISODate(batch.expiration_date)
    if (!expiry) continue
    for (const offset of offsets) {
      const day = addDays(expiry, -offset)
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), REMINDER_HOUR, 0, 0)
      if (at.getTime() <= now.getTime()) continue // that moment has passed — it is already on the list screen
      const identifier = `expiry-${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}-${offset}`
      const group = groups.get(identifier) ?? { identifier, at, offset, count: 0, names: [] }
      group.count += 1
      if (group.names.length < 3 && !group.names.includes(batch.product_name)) group.names.push(batch.product_name)
      groups.set(identifier, group)
    }
  }
  return [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS)
}
