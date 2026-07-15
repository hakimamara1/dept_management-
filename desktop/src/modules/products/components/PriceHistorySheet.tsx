import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@shared/components/ui/sheet'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { PriceHistoryPoint } from '@shared/types/api'
import { useProductPriceHistory } from '../hooks/useProductPriceHistory'

interface PriceHistorySheetProps {
  productId: number | null
  productName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const columns: ColumnDef<PriceHistoryPoint, any>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
    meta: { exportLabel: 'التاريخ' },
    cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.date)}</span>
  },
  {
    accessorKey: 'price',
    header: ({ column }) => <DataTableColumnHeader column={column} title="سعر الوحدة" />,
    meta: { exportLabel: 'سعر الوحدة' },
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.price)}</span>
  },
  {
    accessorKey: 'quantity',
    header: 'الكمية',
    meta: { exportLabel: 'الكمية' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.quantity.toLocaleString('ar-DZ')}</span>
  },
  {
    accessorKey: 'supplier',
    header: 'المورد',
    meta: { exportLabel: 'المورد' },
    cell: ({ row }) => row.original.supplier ?? '—'
  },
  {
    accessorKey: 'invoiceNumber',
    header: 'الفاتورة',
    meta: { exportLabel: 'الفاتورة' },
    cell: ({ row }) => <span className="text-muted-foreground">#{row.original.invoiceNumber}</span>
  }
]

function StatBlock({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('tabular-nums text-sm font-semibold', valueClassName)}>{value}</div>
    </div>
  )
}

export function PriceHistorySheet({ productId, productName, open, onOpenChange }: PriceHistorySheetProps) {
  const { data, isLoading, error, refetch } = useProductPriceHistory(productId)

  const chartData = useMemo(
    () => (data?.points ?? []).map((p) => ({ ...p, dateLabel: formatDate(p.date) })),
    [data?.points]
  )

  const stats = data?.stats
  // Cost perspective: a rising purchase price is bad news (destructive), a falling one is good (success).
  const trendColor = stats?.trend === 'up' ? 'text-destructive' : stats?.trend === 'down' ? 'text-success' : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{productName ? `سجل الأسعار — ${productName}` : 'سجل الأسعار'}</SheetTitle>
          <SheetDescription>اتجاه سعر الشراء لهذا المنتج عبر الفواتير المعتمدة</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-4">
          {isLoading ? (
            <LoadingState rows={3} />
          ) : error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : !stats || chartData.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="لا يوجد سجل أسعار بعد"
              description="سيظهر هنا اتجاه السعر بعد أول فاتورة معتمدة لهذا المنتج"
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatBlock label="آخر سعر" value={formatCurrency(stats.last)} valueClassName={trendColor} />
                <StatBlock label="أقل سعر" value={formatCurrency(stats.min)} valueClassName="text-success" />
                <StatBlock label="أعلى سعر" value={formatCurrency(stats.max)} valueClassName="text-destructive" />
                <StatBlock label="متوسط السعر" value={formatCurrency(stats.avg)} />
                <StatBlock label="عدد الفواتير" value={String(stats.count)} />
                <div className="flex items-center justify-center rounded-md border border-border bg-muted/40 px-3 py-2">
                  {stats.trend === 'flat' ? (
                    <Badge variant="secondary">مستقر</Badge>
                  ) : (
                    <Badge variant={stats.trend === 'up' ? 'destructive' : 'success'}>
                      {stats.trend === 'up' ? '▲' : '▼'} {Math.abs(stats.changePct).toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>

              <div className="h-52 rounded-lg border border-border p-3" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="dateLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                      minTickGap={24}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'السعر']}
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <DataTable
                columns={columns}
                data={[...(data?.points ?? [])].reverse()}
                pageSize={5}
                exportFileName={`price-history-${productId}`}
                emptyTitle="لا توجد بيانات"
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
