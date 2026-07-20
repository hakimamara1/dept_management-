import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { StatCard } from '@shared/components/StatCard'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCompactCurrency, formatCurrency, formatDate } from '@shared/lib/format'
import { usePurchaseAnalytics } from '../hooks/useDashboardAnalytics'

export function PurchaseAnalyticsSection({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { data, isLoading, error } = usePurchaseAnalytics(range, from, to)

  if (isLoading) return <LoadingState rows={6} />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ShoppingCart}
          label="إجمالي قيمة المشتريات"
          value={formatCompactCurrency(data.totalAmount)}
          tooltip="إجمالي قيمة الفواتير المعتمدة خلال الفترة المحددة"
        />
        <StatCard
          icon={Receipt}
          label="عدد الفواتير"
          value={String(data.totalInvoiceCount)}
          tooltip="عدد الفواتير المعتمدة خلال الفترة المحددة"
        />
        <StatCard
          icon={TrendingUp}
          label="متوسط قيمة الفاتورة"
          value={formatCompactCurrency(data.averageInvoiceAmount)}
          tooltip="متوسط قيمة الفاتورة الواحدة خلال الفترة المحددة"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المشتريات عبر الفترة</CardTitle>
        </CardHeader>
        <CardContent>
          {data.perPeriod.length === 0 ? (
            <EmptyState icon={BarChart3} title="لا توجد مشتريات لهذه الفترة" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.perPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="period"
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
                    formatter={(value, name) => [
                      name === 'total' ? formatCurrency(Number(value)) : value,
                      name === 'total' ? 'إجمالي المشتريات' : 'عدد الفواتير'
                    ]}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أكبر الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            {data.largestInvoices.length === 0 ? (
              <EmptyState icon={Receipt} title="لا توجد فواتير" />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.largestInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{invoice.invoice_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.supplier} · {formatDate(invoice.invoice_date)}
                      </span>
                    </div>
                    <span className="tabular-nums font-semibold text-foreground">
                      {formatCurrency(invoice.invoice_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المشتريات حسب المورد</CardTitle>
          </CardHeader>
          <CardContent>
            {data.bySupplier.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="لا توجد بيانات" />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.bySupplier.map((entry) => (
                  <div key={entry.supplier} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{entry.supplier}</span>
                      <span className="text-xs text-muted-foreground">{entry.invoiceCount} فاتورة</span>
                    </div>
                    <span className="tabular-nums font-semibold text-foreground">{formatCurrency(entry.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
