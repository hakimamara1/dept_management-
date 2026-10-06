import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { formatCompactCurrency, formatCurrency } from '@shared/lib/format'
import { formatPeriod, TOOLTIP_STYLE } from '@shared/lib/chartFormat'
import type { DebtAnalysis } from '@shared/types/api'

export function FlowsChart({ data }: { data: DebtAnalysis }) {
  const isSuppliers = data.scope === 'suppliers'
  const labels: Record<string, string> = {
    purchases: isSuppliers ? 'المشتريات' : 'المبيعات',
    payments: isSuppliers ? 'المدفوعات' : 'التحصيلات',
    adjustments: 'التسويات'
  }
  const hasData = data.perPeriod.some((p) => p.purchases || p.payments || p.adjustments)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.purchases} مقابل {labels.payments}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState icon={BarChart3} title="لا توجد حركات في هذه الفترة" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.perPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tickLine={false} axisLine={false} width={64}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), labels[String(name)] ?? name]}
                  labelFormatter={(p) => formatPeriod(String(p))} contentStyle={TOOLTIP_STYLE} />
                <Legend formatter={(name) => labels[String(name)] ?? name} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="purchases" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payments" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="adjustments" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
