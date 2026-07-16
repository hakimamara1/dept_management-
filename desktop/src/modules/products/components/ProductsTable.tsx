import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { LineChart, Pencil, Search } from 'lucide-react'
import { Input } from '@shared/components/ui/input'
import { Button } from '@shared/components/ui/button'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { EmptyState } from '@shared/components/EmptyState'
import { formatCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import type { Product } from '@shared/types/api'
import { useProductSearch } from '../hooks/useProductSearch'
import { PriceHistorySheet } from './PriceHistorySheet'
import { EditSalePriceDialog } from './EditSalePriceDialog'

const UNIT_LABELS: Record<string, string> = {
  piece: 'قطعة',
  kg: 'كيلو',
  box: 'علبة',
  liter: 'لتر',
  g: 'غرام'
}

export function ProductsTable() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null)
  const [editPriceProduct, setEditPriceProduct] = useState<Product | null>(null)

  const { data, isLoading, error } = useProductSearch(query)

  const columns: ColumnDef<Product, any>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم المنتج" />,
      meta: { exportLabel: 'اسم المنتج' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>
    },
    {
      accessorKey: 'barcode',
      header: 'الباركود',
      meta: { exportLabel: 'الباركود' },
      cell: ({ row }) => row.original.barcode ?? '—'
    },
    {
      accessorKey: 'category',
      header: 'الفئة',
      meta: { exportLabel: 'الفئة' },
      cell: ({ row }) => row.original.category ?? '—'
    },
    {
      accessorKey: 'unit',
      header: 'الوحدة',
      meta: { exportLabel: 'الوحدة' },
      cell: ({ row }) => (row.original.unit ? UNIT_LABELS[row.original.unit] ?? row.original.unit : '—')
    },
    {
      accessorKey: 'current_stock',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المخزون" />,
      meta: { exportLabel: 'المخزون' },
      cell: ({ row }) => {
        const stock = Number(row.original.current_stock ?? 0)
        return (
          <span className={cn('tabular-nums font-semibold', stock > 0 ? 'text-success' : 'text-destructive')}>
            {stock.toLocaleString('ar-DZ')}
          </span>
        )
      }
    },
    {
      accessorKey: 'average_cost',
      header: 'التكلفة',
      meta: { exportLabel: 'متوسط التكلفة' },
      cell: ({ row }) => (
        <div className="text-xs">
          {row.original.last_purchase_price != null && (
            <div className="text-muted-foreground">آخر شراء: {formatCurrency(row.original.last_purchase_price)}</div>
          )}
          {row.original.average_cost != null && (
            <div className="text-primary">متوسط: {formatCurrency(row.original.average_cost)}</div>
          )}
        </div>
      )
    },
    {
      accessorKey: 'default_sale_price',
      header: 'سعر البيع',
      meta: { exportLabel: 'سعر البيع' },
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setEditPriceProduct(row.original)}
          className="group flex items-center gap-1.5 text-xs hover:text-primary"
        >
          {row.original.default_sale_price != null ? (
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(row.original.default_sale_price)}
            </span>
          ) : (
            <span className="text-muted-foreground">تعيين سعر</span>
          )}
          <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      )
    },
    {
      id: 'actions',
      header: 'سعر الشراء',
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setPriceHistoryProduct(row.original)}>
          <LineChart className="size-3.5" />
          {t('products.priceHistory')}
        </Button>
      )
    }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={query.trim().length > 0 && isLoading}
        exportFileName="products"
        emptyTitle={query.trim() ? `لا نتائج لـ "${query}"` : t('products.searchPlaceholder')}
        emptyDescription={query.trim() ? 'حاول بكلمات أخرى أو أضف المنتج يدوياً' : undefined}
        toolbar={
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('products.searchPlaceholder')}
              className="ps-9"
            />
          </div>
        }
      />

      {error && (
        <div className="mt-3">
          <EmptyState icon={Search} title="فشل البحث" description={error.message} />
        </div>
      )}

      <PriceHistorySheet
        productId={priceHistoryProduct?.id ?? null}
        productName={priceHistoryProduct?.name ?? null}
        open={priceHistoryProduct != null}
        onOpenChange={(open) => !open && setPriceHistoryProduct(null)}
      />

      <EditSalePriceDialog product={editPriceProduct} onOpenChange={(open) => !open && setEditPriceProduct(null)} />
    </>
  )
}
