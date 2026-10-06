import { Banknote, Hash, Scale, TrendingUp } from 'lucide-react'
import { StatCard } from '@shared/components/StatCard'
import { formatCompactCurrency } from '@shared/lib/format'
import type { KpiComparison, PaymentAnalytics } from '@shared/types/api'

function toDelta(kpi: KpiComparison) {
  // Paying more is good news (debt shrinks), so an upward move is "good".
  return { label: `${Math.abs(kpi.changePercent)}%`, direction: kpi.direction, upIsGood: true }
}

export function PaymentKpiGrid({ data, isLoading }: { data?: PaymentAnalytics; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCard key={i} icon={Banknote} label="" value="" loading />
        ))}
      </div>
    )
  }

  const { kpis } = data
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Banknote}
        label="إجمالي المدفوعات"
        value={formatCompactCurrency(kpis.totalPaid.value)}
        delta={toDelta(kpis.totalPaid)}
        tooltip="مجموع الدفعات المسجلة في الفترة المحددة، مقارنةً بالفترة السابقة المماثلة"
      />
      <StatCard
        icon={Hash}
        label="عدد الدفعات"
        value={String(kpis.paymentCount.value)}
        delta={toDelta(kpis.paymentCount)}
        tooltip="عدد عمليات الدفع في الفترة المحددة"
      />
      <StatCard
        icon={Scale}
        label="متوسط الدفعة"
        value={formatCompactCurrency(kpis.averagePayment.value)}
        delta={toDelta(kpis.averagePayment)}
        tooltip="إجمالي المدفوعات ÷ عدد الدفعات"
      />
      <StatCard
        icon={TrendingUp}
        label="أكبر دفعة"
        value={formatCompactCurrency(kpis.largestPayment.value)}
        delta={toDelta(kpis.largestPayment)}
        tooltip="أكبر دفعة منفردة في الفترة المحددة"
      />
    </div>
  )
}
