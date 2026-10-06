import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { DebtAnalysis } from '@shared/types/api'
import type { DebtVerdict } from '../lib/debtVerdict'

const pct = (v: number | null) => (v == null ? '—' : `${v}%`)

export function DebtAnalysisSection({ data, verdict }: { data: DebtAnalysis; verdict: DebtVerdict }) {
  const isSuppliers = data.scope === 'suppliers'
  const { current: c, previous: p, range } = data

  const rows: { label: string; cur: string; prev: string }[] = [
    { label: 'الدين في البداية', cur: formatCurrency(c.beginning), prev: formatCurrency(p.beginning) },
    { label: isSuppliers ? 'المشتريات' : 'المبيعات', cur: formatCurrency(c.purchases), prev: formatCurrency(p.purchases) },
    { label: isSuppliers ? 'المدفوعات' : 'التحصيلات', cur: formatCurrency(c.payments), prev: formatCurrency(p.payments) },
    { label: 'التسويات', cur: formatCurrency(c.adjustments), prev: formatCurrency(p.adjustments) },
    { label: 'الدين في النهاية', cur: formatCurrency(c.ending), prev: formatCurrency(p.ending) },
    { label: 'التغير في الدين', cur: formatCurrency(c.change), prev: formatCurrency(p.change) },
    { label: 'نسبة السداد', cur: pct(c.paymentRatio), prev: pct(p.paymentRatio) }
  ]

  const maxAbs = Math.max(1, ...verdict.drivers.map((d) => Math.abs(d.value)))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>ما الذي حرّك الدين؟</CardTitle>
          <p className="text-xs text-muted-foreground">مساهمة كل عنصر في تغيّر الدين خلال الفترة</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {verdict.drivers.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-foreground">{d.label}</span>
                <span className={cn('tabular-nums font-medium', d.value > 0 ? 'text-destructive' : d.value < 0 ? 'text-success' : 'text-muted-foreground')}>
                  {d.value > 0 ? '+' : d.value < 0 ? '−' : ''}{formatCurrency(Math.abs(d.value))}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={cn('h-2 rounded-full', d.value > 0 ? 'bg-destructive' : 'bg-success')}
                  style={{ width: `${(Math.abs(d.value) / maxAbs) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">الأحمر يرفع الدين والأخضر يخفضه.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مقارنة مع الفترة السابقة</CardTitle>
          <p className="text-xs text-muted-foreground">
            {formatDate(range.prevStartDate)} — {formatDate(range.prevEndDate)}
          </p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-start font-medium">البند</th>
                <th className="py-2 text-start font-medium">هذه الفترة</th>
                <th className="py-2 text-start font-medium">السابقة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="py-2 text-foreground">{r.label}</td>
                  <td className="tabular-nums py-2 font-medium">{r.cur}</td>
                  <td className="tabular-nums py-2 text-muted-foreground">{r.prev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

