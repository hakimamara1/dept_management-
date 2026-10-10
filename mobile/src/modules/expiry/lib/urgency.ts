import type { ExpirationBatch } from '@desktop-types/api'
import { daysBetween, parseISODate } from '@/shared/lib/dates'

export type Bucket = 'expired' | 'week' | 'month' | 'later' | 'closed'
export const OPEN_BUCKETS: Exclude<Bucket, 'closed'>[] = ['expired', 'week', 'month', 'later']

/** SOLD / DISCARDED are user-set terminal states; everything else is decided by the date alone. */
export const isClosed = (b: Pick<ExpirationBatch, 'computed_status' | 'status'>) =>
  b.computed_status === 'SOLD' || b.computed_status === 'DISCARDED' || b.status === 'SOLD' || b.status === 'DISCARDED'

/** Days until the expiry date by calendar (0 = today). The server's value truncates a fractional day, so it is not used. */
export function daysLeft(expirationDate: string, now = new Date()): number {
  const d = parseISODate(expirationDate)
  return d ? daysBetween(now, d) : Number.POSITIVE_INFINITY
}

export function bucketOf(batch: Pick<ExpirationBatch, 'computed_status' | 'status' | 'expiration_date'>, now = new Date()): Bucket {
  if (isClosed(batch)) return 'closed'
  const days = daysLeft(batch.expiration_date, now)
  if (days < 0) return 'expired'
  if (days <= 7) return 'week'
  if (days <= 30) return 'month'
  return 'later'
}

export type Grouped = Record<Bucket, ExpirationBatch[]>

/** Buckets sorted most-urgent-first; closed batches are sorted newest-first. */
export function groupBatches(batches: ExpirationBatch[], now = new Date()): Grouped {
  const out: Grouped = { expired: [], week: [], month: [], later: [], closed: [] }
  for (const b of batches) out[bucketOf(b, now)].push(b)
  for (const key of OPEN_BUCKETS) out[key].sort((a, b) => a.expiration_date.localeCompare(b.expiration_date) || a.id - b.id)
  out.closed.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return out
}
