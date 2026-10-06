import { formatDate } from '@shared/lib/format'

/** Bucket keys are 'YYYY-MM-DD' (day) or 'YYYY-MM' (month). */
export function formatPeriod(period: string): string {
  if (period.length === 7) {
    return new Date(`${period}-01`).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short' })
  }
  return formatDate(period)
}

export const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12
} as const
