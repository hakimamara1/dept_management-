import { useState } from 'react'
import type { DashboardRange } from '@shared/types/api'

export const DATE_RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'last_month', label: 'الشهر الماضي' },
  { value: '3months', label: 'آخر 3 أشهر' },
  { value: 'year', label: 'هذه السنة' },
  { value: 'custom', label: 'نطاق مخصص' }
]

/** Shared date-range state driving every range-aware dashboard section. */
export function useDateRange() {
  const [range, setRange] = useState<DashboardRange>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  return {
    range,
    setRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    // Only meaningful once both custom dates are set — callers should treat
    // range==='custom' with missing from/to as "not ready yet".
    isCustomReady: range !== 'custom' || (!!customFrom && !!customTo)
  }
}
