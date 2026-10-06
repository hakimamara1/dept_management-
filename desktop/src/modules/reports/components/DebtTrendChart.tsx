import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { formatCompactCurrency, formatCurrency } from '@shared/lib/format'
import { formatPeriod, TOOLTIP_STYLE } from '@shared/lib/chartFormat'
import type { DebtAnalysis } from '@shared/types/api'

export function DebtTrendChart({ data }: { data: DebtAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تطور {data.scope === 'suppliers' ? 'الدين' : 'ديون العملاء'} خلال الفترة</CardTitle>
      </CardHeader>
      <CardContent>
        {data.evolution.length === 0 ? (
          <EmptyState icon={LineChartIcon} title="لا توجد بيانات لهذه الفترة" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.evolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="debtTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={formatPeriod} tickLine={false} axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tickLine={false} axisLine={false} width={64}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'الدين']}
                  labelFormatter={(d) => formatPeriod(String(d))} contentStyle={TOOLTIP_STYLE} />
                <Area type="stepAfter" dataKey="debt" stroke="var(--destructive)" strokeWidth={2} fill="url(#debtTrendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
