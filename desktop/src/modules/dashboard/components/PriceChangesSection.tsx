import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { StatCard } from '@shared/components/StatCard'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { PriceChangeEntry } from '@shared/types/api'
import { usePriceChanges } from '../hooks/useDashboardAnalytics'

export function PriceChangesSection({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { data, isLoading, error } = usePriceChanges(range, from, to)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.changes
    return data.changes.filter(
      (c) => c.product.toLowerCase().includes(q) || c.supplier.toLowerCase().includes(q)
    )
  }, [data, query])

  const columns: ColumnDef<PriceChangeEntry, any>[] = [
    {
      accessorKey: 'product',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المنتج" />,
      meta: { exportLabel: 'المنتج' }
    },
    {
      accessorKey: 'supplier',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المورد" />,
      meta: { exportLabel: 'المورد' }
    },
    {
      accessorKey: 'oldPrice',
      header: 'السعر القديم',
      meta: { exportLabel: 'السعر القديم' },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.oldPrice)}</span>
    },
    {
      accessorKey: 'newPrice',
      header: 'السعر الجديد',
      meta: { exportLabel: 'السعر الجديد' },
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.newPrice)}</span>
    },
    {
      accessorKey: 'diff',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الفرق" />,
      meta: { exportLabel: 'الفرق' },
      cell: ({ row }) => {
        const diff = row.original.diff
        return (
          <span className={cn('tabular-nums font-medium', diff > 0 ? 'text-destructive' : diff < 0 ? 'text-success' : '')}>
            {diff > 0 ? '+' : ''}
            {formatCurrency(diff)}
          </span>
        )
      }
    },
    {
      accessorKey: 'percent',
      header: ({ column }) => <DataTableColumnHeader column={column} title="النسبة" />,
      meta: { exportLabel: 'النسبة' },
      cell: ({ row }) => {
        const percent = row.original.percent
        const up = percent > 0
        return (
          <Badge variant={up ? 'destructive' : percent < 0 ? 'success' : 'secondary'}>
            {up ? <ArrowUp className="size-3" /> : percent < 0 ? <ArrowDown className="size-3" /> : null}
            {Math.abs(percent)}%
          </Badge>
        )
      }
    },
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.date)}</span>
    }
  ]

  if (isLoading) return <LoadingState rows={6} />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="ارتفاعات الأسعار"
          value={String(data.summary.increasedCount)}
          tooltip="عدد المنتجات التي ارتفع سعرها خلال الفترة المحددة"
        />
        <StatCard
          icon={TrendingDown}
          label="انخفاضات الأسعار"
          value={String(data.summary.decreasedCount)}
          tooltip="عدد المنتجات التي انخفض سعرها خلال الفترة المحددة"
        />
        <StatCard
          icon={ArrowUp}
          label="متوسط نسبة الارتفاع"
          value={`${data.summary.avgIncreasePercent}%`}
          tooltip="متوسط نسبة الارتفاع لكل المنتجات التي ارتفع سعرها"
        />
        <StatCard
          icon={ArrowDown}
          label="متوسط نسبة الانخفاض"
          value={`${data.summary.avgDecreasePercent}%`}
          tooltip="متوسط نسبة الانخفاض لكل المنتجات التي انخفض سعرها"
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={filtered}
            exportFileName="price-changes"
            getRowId={(row) => `${row.product}-${row.supplier}-${row.date}`}
            emptyTitle={query.trim() ? `لا نتائج لـ "${query}"` : 'لا توجد تغييرات أسعار لهذه الفترة'}
            toolbar={
              <div className="relative max-w-sm flex-1">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث عن منتج أو مورد..."
                  className="ps-9"
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
