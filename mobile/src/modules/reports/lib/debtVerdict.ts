// Port of desktop/src/modules/reports/lib/debtVerdict.ts — keep the wording/thresholds identical.
// (Arabic-only in v1, same as the desktop; the numbers and the verdict logic are the point.)
import { formatCurrency } from '@/shared/lib/format'
import type { DebtAnalysis } from '@desktop-types/api'

export type VerdictStatus = 'down' | 'up' | 'stable'

export interface DebtDriver {
  key: 'purchases' | 'payments' | 'adjustments'
  label: string
  value: number
}

export interface DebtVerdict {
  status: VerdictStatus
  title: string
  lines: string[]
  drivers: DebtDriver[]
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`

export function buildVerdict(a: DebtAnalysis): DebtVerdict {
  const isSuppliers = a.scope === 'suppliers'
  const { current: c, previous: p } = a
  const words = isSuppliers
    ? { purchases: 'مشتريات جديدة', payments: 'دفعات للموردين', debt: 'الدين', purchasesShort: 'اشتريت', paidShort: 'سددت' }
    : { purchases: 'مبيعات جديدة', payments: 'تحصيلات من العملاء', debt: 'ديون العملاء', purchasesShort: 'بعت', paidShort: 'حصّلت' }
  const subject = a.entity ? ` «${a.entity.name}»` : ''

  const level = Math.max(Math.abs(c.beginning), Math.abs(c.ending))
  const status: VerdictStatus = c.change === 0 || Math.abs(c.change) < level * 0.01 ? 'stable' : c.change < 0 ? 'down' : 'up'

  const title =
    status === 'down'
      ? isSuppliers ? '🟢 الدين ينخفض — أنت على الطريق الصحيح' : '🟢 ديون العملاء تنخفض — التحصيل يسير جيداً'
      : status === 'up'
        ? isSuppliers ? '🔴 الدين يرتفع — ديونك تحتاج انتباهاً' : '🔴 ديون العملاء ترتفع — راجع التحصيل'
        : isSuppliers ? '🟡 الدين مستقر تقريباً' : '🟡 ديون العملاء مستقرة تقريباً'

  const drivers: DebtDriver[] = [
    { key: 'purchases', label: words.purchases, value: c.purchases },
    { key: 'payments', label: words.payments, value: -c.payments },
    { key: 'adjustments', label: 'تسويات يدوية', value: c.adjustments }
  ]

  const lines: string[] = []
  const noActivity = c.purchases === 0 && c.payments === 0 && c.adjustments === 0

  if (noActivity) {
    lines.push(`لا توجد حركات${subject} في هذه الفترة، فبقي ${words.debt} ثابتاً عند ${formatCurrency(c.ending)}.`)
  } else {
    const pct = c.changePercent == null ? '' : ` (${Math.abs(c.changePercent)}%)`
    const verb = isSuppliers
      ? status === 'stable' ? 'تغيّر قليلاً' : status === 'up' ? 'ارتفع' : 'انخفض'
      : status === 'stable' ? 'تغيّرت قليلاً' : status === 'up' ? 'ارتفعت' : 'انخفضت'
    lines.push(`${words.debt}${subject} ${verb} بمقدار ${formatCurrency(Math.abs(c.change))}${pct}: من ${formatCurrency(c.beginning)} إلى ${formatCurrency(c.ending)}.`)

    const dominant = [...drivers].filter((d) => d.value !== 0).sort((x, y) => Math.abs(y.value) - Math.abs(x.value))[0]
    if (dominant) {
      if (dominant.key === 'adjustments') {
        lines.push(`السبب الرئيسي: تسويات يدوية بقيمة ${signed(dominant.value)} — وليس ${isSuppliers ? 'مشتريات أو دفعات فعلية' : 'مبيعات أو تحصيلات فعلية'}.`)
      } else if (dominant.key === 'purchases') {
        lines.push(`السبب الرئيسي: ${words.purchases} بقيمة ${formatCurrency(dominant.value)}.`)
      } else {
        lines.push(`السبب الرئيسي: ${words.payments} بقيمة ${formatCurrency(Math.abs(dominant.value))}.`)
      }
    }

    if (c.paymentRatio != null) {
      lines.push(
        c.paymentRatio >= 100
          ? `${words.paidShort} ${c.paymentRatio}% مما ${words.purchasesShort} — أي أكثر من نشاط الفترة.`
          : `${words.paidShort} ${c.paymentRatio}% فقط مما ${words.purchasesShort} — الباقي يُضاف إلى الدين.`
      )
    } else if (c.payments > 0) {
      lines.push(`لا توجد ${words.purchases} في الفترة، وتم ${isSuppliers ? 'تسديد' : 'تحصيل'} ${formatCurrency(c.payments)}.`)
    }
  }

  const prevActive = p.purchases !== 0 || p.payments !== 0 || p.adjustments !== 0
  if (!prevActive) lines.push('لا توجد حركات في الفترة السابقة للمقارنة معها.')
  else if (c.change < p.change) lines.push(`أفضل من الفترة السابقة (التغير السابق: ${signed(p.change)}).`)
  else if (c.change > p.change) lines.push(`أسوأ من الفترة السابقة (التغير السابق: ${signed(p.change)}).`)
  else lines.push('نفس أداء الفترة السابقة.')

  return { status, title, lines, drivers }
}
