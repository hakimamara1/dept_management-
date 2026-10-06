import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { formatCompactCurrency, formatCurrency } from '@shared/lib/format'
import type { PaymentAnalytics } from '@shared/types/api'
import { formatPeriod, TOOLTIP_STYLE } from '@shared/lib/chartFormat'

export function PaymentsTimeChart({ data, isLoading }: { data?: PaymentAnalytics; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>المدفوعات عبر الزمن</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={4} />
        ) : !data || data.perPeriod.length === 0 ? (
          <EmptyState icon={BarChart3} title="لا توجد دفعات في هذه الفترة" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.perPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatPeriod}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${formatCurrency(Number(value))} (${item.payload.count} دفعة)`,
                    'المدفوع'
                  ]}
                  labelFormatter={(p) => formatPeriod(String(p))}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
