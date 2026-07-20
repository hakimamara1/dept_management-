import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCompactCurrency, formatCurrency, formatDate } from '@shared/lib/format'
import { useDebtBySupplier, useDebtEvolution } from '../hooks/useDashboardAnalytics'

// Fixed hue order — never cycled or reassigned per-render (see globals.css).
const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'
]

export function DebtAnalyticsSection({ range, from, to }: { range: string; from?: string; to?: string }) {
  const evolution = useDebtEvolution(range, from, to)
  const bySupplier = useDebtBySupplier(8)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>تطور الدين الإجمالي</CardTitle>
        </CardHeader>
        <CardContent>
          {evolution.isLoading ? (
            <LoadingState rows={4} />
          ) : evolution.error ? (
            <ErrorState message={evolution.error.message} />
          ) : !evolution.data || evolution.data.points.length === 0 ? (
            <EmptyState icon={LineChartIcon} title="لا توجد بيانات كافية لهذه الفترة" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution.data.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="debtEvolutionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => formatDate(v)}
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
                    formatter={(value) => [formatCurrency(Number(value)), 'إجمالي الدين']}
                    labelFormatter={(d) => formatDate(String(d))}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="totalDebt" stroke="var(--destructive)" strokeWidth={2} fill="url(#debtEvolutionFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>توزيع الدين حسب المورد</CardTitle>
        </CardHeader>
        <CardContent>
          {bySupplier.isLoading ? (
            <LoadingState rows={4} />
          ) : bySupplier.error ? (
            <ErrorState message={bySupplier.error.message} />
          ) : !bySupplier.data || bySupplier.data.length === 0 ? (
            <EmptyState icon={LineChartIcon} title="لا توجد ديون حالياً" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bySupplier.data}
                    dataKey="debt"
                    nameKey="supplier"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {bySupplier.data.map((entry, i) => (
                      <Cell key={entry.supplier} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), '']}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>أكبر الموردين ديناً</CardTitle>
        </CardHeader>
        <CardContent>
          {bySupplier.isLoading ? (
            <LoadingState rows={4} />
          ) : !bySupplier.data || bySupplier.data.length === 0 ? (
            <EmptyState icon={LineChartIcon} title="لا توجد ديون حالياً" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySupplier.data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompactCurrency(v)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="supplier"
                    width={140}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'الدين']}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="debt" radius={[0, 4, 4, 0]}>
                    {bySupplier.data.map((entry, i) => (
                      <Cell key={entry.supplier} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
