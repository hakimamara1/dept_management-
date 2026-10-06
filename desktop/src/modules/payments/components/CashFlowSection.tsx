import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Percent, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { StatCard } from '@shared/components/StatCard'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { formatCompactCurrency, formatCurrency } from '@shared/lib/format'
import type { PaymentAnalytics } from '@shared/types/api'
import { formatPeriod, TOOLTIP_STYLE } from '@shared/lib/chartFormat'

const SERIES_LABEL: Record<string, string> = { purchased: 'المشتريات', paid: 'المدفوع' }

/** Paid vs purchased: tells you whether your supplier debt is growing or shrinking. */
export function CashFlowSection({ data, isLoading }: { data?: PaymentAnalytics; isLoading: boolean }) {
  if (isLoading || !data) return <LoadingState rows={5} />

  const { cashFlow } = data
  const debtGrew = cashFlow.netDebtChange > 0
  const flat = cashFlow.netDebtChange === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ShoppingCart}
          label="مشتريات الفترة"
          value={formatCompactCurrency(cashFlow.purchased.value)}
          tooltip="قيمة الفواتير المعتمدة في الفترة (ما اشتريته)"
        />
        <StatCard
          icon={debtGrew ? ArrowUpRight : ArrowDownRight}
          label="التغير في الديون"
          value={`${debtGrew ? '+' : ''}${formatCompactCurrency(cashFlow.netDebtChange)}`}
          tooltip="المشتريات − المدفوعات. موجب = الدين زاد، سالب = الدين نقص"
        />
        <StatCard
          icon={Percent}
          label="نسبة السداد"
          value={cashFlow.paidRatio == null ? '—' : `${cashFlow.paidRatio}%`}
          tooltip="المدفوع ÷ المشتريات في نفس الفترة. أقل من 100% يعني أنك تشتري أكثر مما تسدد"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المدفوع مقابل المشتريات</CardTitle>
          <p className="text-xs text-muted-foreground">
            {flat
              ? 'ما دفعته يساوي ما اشتريته في هذه الفترة — الديون ثابتة.'
              : debtGrew
                ? `اشتريت أكثر مما سددت بمقدار ${formatCurrency(cashFlow.netDebtChange)} — ديونك زادت.`
                : `سددت أكثر مما اشتريت بمقدار ${formatCurrency(Math.abs(cashFlow.netDebtChange))} — ديونك نقصت.`}
          </p>
        </CardHeader>
        <CardContent>
          {cashFlow.perPeriod.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="لا توجد مشتريات ولا دفعات في هذه الفترة" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow.perPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    formatter={(value, name) => [formatCurrency(Number(value)), SERIES_LABEL[String(name)] ?? name]}
                    labelFormatter={(p) => formatPeriod(String(p))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend formatter={(name) => SERIES_LABEL[String(name)] ?? name} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="purchased" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
