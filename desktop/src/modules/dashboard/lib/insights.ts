import type { DashboardKpis, DebtBySupplierEntry, OutstandingDebtEntry, PriceChangesResponse } from '@shared/types/api'
import { formatCompactCurrency } from '@shared/lib/format'

export interface Insight {
  id: string
  text: string
}

export interface Alert {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
}

export function generateInsights(
  kpis: DashboardKpis | undefined,
  debtBySupplier: DebtBySupplierEntry[] | undefined,
  priceChanges: PriceChangesResponse | undefined
): Insight[] {
  const insights: Insight[] = []
  if (!kpis) return insights

  if (kpis.purchasesThisPeriod.direction !== 'flat') {
    const up = kpis.purchasesThisPeriod.direction === 'up'
    insights.push({
      id: 'purchases-trend',
      text: `مشترياتك ${up ? 'ارتفعت' : 'انخفضت'} بنسبة ${Math.abs(kpis.purchasesThisPeriod.changePercent)}% مقارنة بالفترة السابقة`
    })
  }

  if (kpis.totalDebt.direction !== 'flat') {
    const up = kpis.totalDebt.direction === 'up'
    insights.push({
      id: 'debt-trend',
      text: `إجمالي دين الموردين ${up ? 'ارتفع' : 'انخفض'} بنسبة ${Math.abs(kpis.totalDebt.changePercent)}% مقارنة بالفترة السابقة`
    })
  }

  const topSupplier = debtBySupplier?.[0]
  if (topSupplier && kpis.totalDebt.value > 0) {
    const share = Math.round((topSupplier.debt / kpis.totalDebt.value) * 100)
    if (share >= 20) {
      insights.push({
        id: 'top-supplier-share',
        text: `المورد "${topSupplier.supplier}" يمثل ${share}% من إجمالي دينك الحالي (${formatCompactCurrency(topSupplier.debt)})`
      })
    }
  }

  if (priceChanges && priceChanges.summary.increasedCount > 0) {
    insights.push({
      id: 'price-increases',
      text: `${priceChanges.summary.increasedCount} منتج ارتفع سعره خلال هذه الفترة، بمتوسط ${priceChanges.summary.avgIncreasePercent}%`
    })
  }

  if (priceChanges && priceChanges.summary.decreasedCount > 0) {
    insights.push({
      id: 'price-decreases',
      text: `${priceChanges.summary.decreasedCount} منتج انخفض سعره خلال هذه الفترة، بمتوسط ${priceChanges.summary.avgDecreasePercent}%`
    })
  }

  if (kpis.totalSuppliers > 0) {
    const share = Math.round((kpis.suppliersWithOutstandingDebt / kpis.totalSuppliers) * 100)
    if (share >= 40) {
      insights.push({
        id: 'suppliers-outstanding-share',
        text: `${share}% من مورديك (${kpis.suppliersWithOutstandingDebt} من ${kpis.totalSuppliers}) لديهم رصيد مستحق حالياً`
      })
    }
  }

  return insights
}

export function generateAlerts(
  kpis: DashboardKpis | undefined,
  debtBySupplier: DebtBySupplierEntry[] | undefined,
  priceChanges: PriceChangesResponse | undefined,
  outstandingDebts: OutstandingDebtEntry[] | undefined
): Alert[] {
  const alerts: Alert[] = []
  if (!kpis) return alerts

  const topSupplier = debtBySupplier?.[0]
  if (topSupplier && kpis.totalDebt.value > 0) {
    const share = topSupplier.debt / kpis.totalDebt.value
    if (share >= 0.3) {
      alerts.push({
        id: 'debt-concentration',
        severity: 'high',
        title: 'تركز دين مرتفع لدى مورد واحد',
        description: `المورد "${topSupplier.supplier}" يستحوذ على ${Math.round(share * 100)}% من إجمالي دينك (${formatCompactCurrency(topSupplier.debt)})`
      })
    }
  }

  if (kpis.totalSuppliers > 0 && kpis.suppliersWithOutstandingDebt / kpis.totalSuppliers >= 0.5) {
    alerts.push({
      id: 'many-outstanding-suppliers',
      severity: 'medium',
      title: 'عدد كبير من الموردين لديهم ديون مستحقة',
      description: `${kpis.suppliersWithOutstandingDebt} من أصل ${kpis.totalSuppliers} مورد لديهم رصيد مستحق حالياً`
    })
  }

  const highPriorityDebts = (outstandingDebts ?? []).filter((d) => d.priority === 'high')
  if (highPriorityDebts.length > 0) {
    const total = highPriorityDebts.reduce((sum, d) => sum + d.amount, 0)
    alerts.push({
      id: 'aging-debt',
      severity: 'high',
      title: 'ديون متأخرة لأكثر من 60 يوماً',
      description: `${highPriorityDebts.length} مورد لديه دين متأخر (+60 يوم) بإجمالي ${formatCompactCurrency(total)}`
    })
  }

  const bigIncreases = (priceChanges?.changes ?? []).filter((c) => c.percent >= 15)
  if (bigIncreases.length > 0) {
    const top = bigIncreases[0]
    alerts.push({
      id: 'price-spike',
      severity: 'medium',
      title: 'ارتفاع سعر ملحوظ',
      description:
        bigIncreases.length === 1
          ? `سعر "${top.product}" من "${top.supplier}" ارتفع بنسبة ${top.percent}%`
          : `${bigIncreases.length} منتجات ارتفع سعرها بنسبة 15% أو أكثر، أبرزها "${top.product}" (${top.percent}%)`
    })
  }

  return alerts
}
