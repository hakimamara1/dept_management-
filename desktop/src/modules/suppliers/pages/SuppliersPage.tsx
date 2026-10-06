import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { Input } from '@shared/components/ui/input'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import type { Supplier, SupplierAging } from '@shared/types/api'
import { useSupplierAging, useSuppliers } from '../hooks/useSuppliers'
import { CreateSupplierDialog } from '../components/CreateSupplierDialog'
import { EditSupplierDialog } from '../components/EditSupplierDialog'

type SubTab = 'all' | 'aging'

export function SuppliersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<SubTab>('all')
  const [query, setQuery] = useState('')

  const suppliers = useSuppliers(query)
  const aging = useSupplierAging()

  const supplierColumns: ColumnDef<Supplier, any>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم المورد" />,
      meta: { exportLabel: 'اسم المورد' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>
    },
    {
      accessorKey: 'phone',
      header: 'الهاتف',
      meta: { exportLabel: 'الهاتف' },
      cell: ({ row }) => row.original.phone ?? '—'
    },
    {
      accessorKey: 'current_balance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الرصيد الحالي" />,
      meta: { exportLabel: 'الرصيد الحالي' },
      cell: ({ row }) => {
        const balance = Number(row.original.current_balance)
        return (
          <span className={cn('tabular-nums font-semibold', balance > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {formatCurrency(balance)}
          </span>
        )
      }
    },
    {
      accessorKey: 'invoice_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="عدد الفواتير" />,
      meta: { exportLabel: 'عدد الفواتير' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.invoice_count ?? 0}</span>
    },
    {
      accessorKey: 'last_invoice_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="آخر فاتورة" />,
      meta: { exportLabel: 'آخر فاتورة' },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.last_invoice_date ? formatDate(row.original.last_invoice_date) : '—'}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => navigate(`/suppliers/${row.original.id}`)}>
            عرض السجل
          </Button>
          <EditSupplierDialog supplier={row.original} iconOnly />
        </div>
      )
    }
  ]

  const agingColumns: ColumnDef<SupplierAging, any>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم المورد" />,
      meta: { exportLabel: 'اسم المورد' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>
    },
    {
      accessorKey: 'current_balance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الرصيد" />,
      meta: { exportLabel: 'الرصيد' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.current_balance)}</span>
    },
    { accessorKey: '_0_30', header: '0-30 يوم', meta: { exportLabel: '0-30 يوم' }, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original._0_30)}</span> },
    { accessorKey: '_30_60', header: '30-60 يوم', meta: { exportLabel: '30-60 يوم' }, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original._30_60)}</span> },
    { accessorKey: '_60_90', header: '60-90 يوم', meta: { exportLabel: '60-90 يوم' }, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original._60_90)}</span> },
    {
      accessorKey: '_90_plus',
      header: '+90 يوم',
      meta: { exportLabel: '+90 يوم' },
      cell: ({ row }) =>
        row.original._90_plus > 0 ? (
          <Badge variant="destructive">{formatCurrency(row.original._90_plus)}</Badge>
        ) : (
          <span className="tabular-nums text-muted-foreground">{formatCurrency(row.original._90_plus)}</span>
        )
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={<CreateSupplierDialog />}
      />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('all')}>
          كل الموردين
        </Button>
        <Button variant={tab === 'aging' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('aging')}>
          {t('suppliers.aging')}
        </Button>
      </div>

      {tab === 'all' ? (
        <DataTable
          columns={supplierColumns}
          data={suppliers.data ?? []}
          isLoading={suppliers.isLoading}
          exportFileName="suppliers"
          toolbar={
            <div className="relative max-w-sm">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('suppliers.searchPlaceholder')}
                className="ps-9"
              />
            </div>
          }
        />
      ) : (
        <DataTable columns={agingColumns} data={aging.data ?? []} isLoading={aging.isLoading} exportFileName="suppliers-aging" />
      )}
    </div>
  )
}
