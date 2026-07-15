import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCompactCurrency, formatCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { usePurchaseTrend } from '../hooks/useDashboardData'

function monthLabel(month: string) {
  const [year, m] = month.split('-')
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('ar-DZ', { month: 'short' })
}

export function PurchaseTrendChart() {
  const { t } = useI18n()
  const { data, isLoading, error } = usePurchaseTrend()

  const points = [...(data ?? [])].reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.purchaseTrend')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={4} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : points.length === 0 ? (
          <EmptyState icon={TrendingUp} title="لا توجد بيانات مشتريات بعد" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="purchaseTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
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
                  formatter={(value) => [formatCurrency(Number(value)), 'إجمالي المشتريات']}
                  labelFormatter={(month) => monthLabel(String(month))}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total_amount"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#purchaseTrendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
