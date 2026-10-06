import { Activity, Banknote, Flag, Hash, Percent, Scale, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { StatCard } from '@shared/components/StatCard'
import { formatCompactCurrency } from '@shared/lib/format'
import type { DebtAnalysis, KpiComparison } from '@shared/types/api'

function delta(kpi: KpiComparison, upIsGood: boolean) {
  return { label: `${Math.abs(kpi.changePercent)}%`, direction: kpi.direction, upIsGood }
}

const signedCompact = (n: number) => `${n > 0 ? '+' : ''}${formatCompactCurrency(n)}`

export function DebtKpiGrid({ data }: { data: DebtAnalysis }) {
  const { current: c, comparison: cmp } = data
  const isSuppliers = data.scope === 'suppliers'
  const buy = isSuppliers ? 'المشتريات' : 'المبيعات'
  const pay = isSuppliers ? 'المدفوعات' : 'التحصيلات'

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={Flag} label="الدين في بداية الفترة" value={formatCompactCurrency(c.beginning)}
        tooltip="إجمالي الدين قبل أول يوم في الفترة المحددة" />
      <StatCard icon={isSuppliers ? ShoppingCart : TrendingUp} label={`${buy} خلال الفترة`} value={formatCompactCurrency(c.purchases)}
        delta={delta(cmp.purchases, !isSuppliers)} tooltip={`${buy} المسجلة في الفترة، مقارنةً بالفترة السابقة المماثلة`} />
      <StatCard icon={Banknote} label={`${pay} خلال الفترة`} value={formatCompactCurrency(c.payments)}
        delta={delta(cmp.payments, true)} tooltip={`${pay} المسجلة في الفترة، مقارنةً بالفترة السابقة المماثلة`} />
      <StatCard icon={Scale} label="التسويات اليدوية" value={signedCompact(c.adjustments)}
        delta={delta(cmp.adjustments, false)} tooltip="تصحيحات يدوية للرصيد — موجبة تزيد الدين وسالبة تنقصه. تُحسب كحركة مستقلة ولا تعدّل الفواتير أو الدفعات" />
      <StatCard icon={Wallet} label="الدين في نهاية الفترة" value={formatCompactCurrency(c.ending)}
        delta={delta(cmp.ending, false)} tooltip="البداية + المشتريات − المدفوعات ± التسويات" />
      <StatCard icon={c.change <= 0 ? TrendingDown : TrendingUp} label="التغير في الدين"
        value={`${signedCompact(c.change)}${c.changePercent == null ? '' : ` (${c.changePercent}%)`}`}
        delta={delta(cmp.change, false)} tooltip="النهاية − البداية. سالب = الدين انخفض (جيد)" />
      <StatCard icon={Percent} label={`نسبة ${pay} إلى ${buy}`} value={c.paymentRatio == null ? '—' : `${c.paymentRatio}%`}
        tooltip={`${pay} ÷ ${buy}. أقل من 100% يعني أن الجزء المتبقي يُضاف إلى الدين`} />
      <StatCard icon={data.entity ? Hash : Activity} label="عدد الفواتير · الدفعات"
        value={`${c.invoiceCount} · ${c.paymentCount}`} tooltip="عدد الفواتير وعدد الدفعات المسجلة في الفترة" />
    </div>
  )
}
