// Calendar-date helpers. A batch expiry is a CALENDAR date ('YYYY-MM-DD'), never an instant, so everything here works in
// local time and compares whole days — no UTC shifting, no "expires tomorrow" showing as today at 14:00.

const ISO = /^(\d{4})-(\d{2})-(\d{2})/

/** 'YYYY-MM-DD' → local Date at midnight; null when it is not a real calendar date (e.g. 2026-02-31). */
export function parseISODate(value: string | null | undefined): Date | null {
  const m = value ? ISO.exec(value) : null
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Month arithmetic that clamps (31 Jan + 1 month = 28/29 Feb), not rolls over into March. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay))
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / 86_400_000)
}
