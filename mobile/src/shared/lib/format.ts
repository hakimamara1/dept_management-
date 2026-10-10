// Mirrors desktop/src/shared/lib/format.ts so numbers read identically on both devices — and follows the app
// language: Arabic keeps ar-DZ + "دج"; French/English use their own separators, month names and "DA".
type Lang = 'ar' | 'fr' | 'en'

const LOCALES: Record<Lang, { locale: string; unit: string }> = {
  ar: { locale: 'ar-DZ', unit: 'دج' },
  fr: { locale: 'fr-DZ', unit: 'DA' },
  en: { locale: 'en-GB', unit: 'DA' }
}

let current: Lang = 'ar'

/** Called by the language store whenever the language is (re)loaded or changed. */
export function setFormatLanguage(lang: Lang) {
  current = lang
}

const loc = () => LOCALES[current]

export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString(loc().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${loc().unit}`
}

export function formatCompactCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(n)) return '—'
  return `${new Intl.NumberFormat(loc().locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)} ${loc().unit}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // 'YYYY-MM-DD' is a calendar date, not an instant: parse it as local so it never shifts a day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(loc().locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Chart bucket keys are 'YYYY-MM-DD' (day) or 'YYYY-MM' (month). */
export function formatPeriod(period: string): string {
  if (period.length === 7) {
    return new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1).toLocaleDateString(loc().locale, { year: 'numeric', month: 'short' })
  }
  return formatDate(period)
}

/** "12.5%" / "-5.7%". A leading LRM keeps the sign on the left in right-to-left text (otherwise "-5.7%" renders as "5.7%-"). */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `\u200E${value.toFixed(digits)}%`
}
