import { AlertCircle, Banknote, Receipt, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react'
import { StatCard } from '@shared/components/StatCard'
import { formatCompactCurrency } from '@shared/lib/format'
import type { KpiComparison } from '@shared/types/api'
import { useDashboardKpis } from '../hooks/useDashboardAnalytics'

function toDelta(kpi: KpiComparison, upIsGood: boolean) {
  return {
    label: `${Math.abs(kpi.changePercent)}%`,
    direction: kpi.direction,
    upIsGood
  }
}

export function KpiGrid({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { data, isLoading } = useDashboardKpis(range, from, to)

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <StatCard key={i} icon={Wallet} label="" value="" loading />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Wallet}
        label="إجمالي ديون الموردين"
        value={formatCompactCurrency(data.totalDebt.value)}
        delta={toDelta(data.totalDebt, false)}
        tooltip="الرصيد الحالي المستحق لجميع الموردين مجتمعين"
      />
      <StatCard
        icon={ShoppingCart}
        label="إجمالي المشتريات"
        value={formatCompactCurrency(data.totalPurchases.value)}
        delta={toDelta(data.totalPurchases, true)}
        tooltip="إجمالي قيمة كل الفواتير المعتمدة منذ البداية"
      />
      <StatCard
        icon={TrendingUp}
        label="مشتريات الفترة المحددة"
        value={formatCompactCurrency(data.purchasesThisPeriod.value)}
        delta={toDelta(data.purchasesThisPeriod, true)}
        tooltip="قيمة الفواتير المعتمدة خلال الفترة المحددة أعلاه"
      />
      <StatCard
        icon={Banknote}
        label="مدفوعات الفترة المحددة"
        value={formatCompactCurrency(data.paymentsThisPeriod.value)}
        delta={toDelta(data.paymentsThisPeriod, true)}
        tooltip="المبالغ المدفوعة للموردين خلال الفترة المحددة أعلاه"
      />
      <StatCard
        icon={Users}
        label="إجمالي الموردين"
        value={String(data.totalSuppliers)}
        tooltip="عدد الموردين المسجلين في النظام"
      />
      <StatCard
        icon={AlertCircle}
        label="موردون لديهم ديون مستحقة"
        value={String(data.suppliersWithOutstandingDebt)}
        tooltip="عدد الموردين الذين لديهم رصيد مستحق حالياً أكبر من صفر"
      />
      <StatCard
        icon={Receipt}
        label="متوسط قيمة الفاتورة"
        value={formatCompactCurrency(data.averageInvoiceValue.value)}
        delta={toDelta(data.averageInvoiceValue, true)}
        tooltip="متوسط قيمة الفواتير المعتمدة خلال الفترة المحددة"
      />
    </div>
  )
}
