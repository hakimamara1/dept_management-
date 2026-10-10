import type { TranslationKey } from '@/shared/i18n/dictionaries'

/**
 * "Expires today" / "In 12 days" / "Expired 3 days ago" in the app language.
 * Arabic changes the noun with the count (يومين / 3–10 أيام / 11+ يوماً), so those get their own strings;
 * French and English map the extra keys to the same plain sentence.
 */
export function daysLabel(days: number, t: (key: TranslationKey) => string): string {
  if (!Number.isFinite(days)) return '—'
  const n = Math.abs(days)
  const fill = (key: TranslationKey) => t(key).replace('{n}', String(n))
  if (days === 0) return t('expiry.days.today')
  if (days === 1) return t('expiry.days.tomorrow')
  if (days > 0) return n === 2 ? t('expiry.days.in.two') : n <= 10 ? fill('expiry.days.in.few') : fill('expiry.days.in')
  return n === 2 ? t('expiry.days.ago.two') : n <= 10 ? fill('expiry.days.ago.few') : fill('expiry.days.ago')
}
