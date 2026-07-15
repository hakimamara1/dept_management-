import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import type { PurchaseOrder, PurchaseOrderStatus } from '@shared/types/api'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { CreatePOSheet } from '../components/CreatePOSheet'

const STATUS_BADGE: Record<PurchaseOrderStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' }> = {
  Draft: { label: 'مسودة', variant: 'secondary' },
  Sent: { label: 'تم الإرسال', variant: 'warning' },
  Received: { label: 'تم الاستلام', variant: 'success' },
  Cancelled: { label: 'ملغي', variant: 'destructive' }
}

export function PurchaseOrdersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const orders = usePurchaseOrders()

  const columns: ColumnDef<PurchaseOrder, any>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <DataTableColumnHeader column={column} title="رقم الأمر" />,
      meta: { exportLabel: 'رقم الأمر' },
      cell: ({ row }) => <span className="font-medium text-foreground">PO-{row.original.id}</span>
    },
    { accessorKey: 'supplier_name', header: 'المورد', meta: { exportLabel: 'المورد' } },
    {
      accessorKey: 'status',
      header: 'الحالة',
      meta: { exportLabel: 'الحالة' },
      cell: ({ row }) => {
        const badge = STATUS_BADGE[row.original.status]
        return <Badge variant={badge.variant}>{badge.label}</Badge>
      }
    },
    {
      accessorKey: 'order_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="تاريخ الطلب" />,
      meta: { exportLabel: 'تاريخ الطلب' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.order_date)}</span>
    },
    {
      accessorKey: 'expected_date',
      header: 'الاستلام المتوقع',
      meta: { exportLabel: 'الاستلام المتوقع' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.expected_date)}</span>
    },
    {
      accessorKey: 'item_count',
      header: 'الأصناف',
      meta: { exportLabel: 'الأصناف' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.item_count}</span>
    },
    {
      accessorKey: 'expected_total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="القيمة المتوقعة" />,
      meta: { exportLabel: 'القيمة المتوقعة' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.expected_total)}</span>
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/purchase-orders/${row.original.id}`)}>
          عرض
        </Button>
      )
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('purchaseOrders.title')} subtitle={t('purchaseOrders.subtitle')} actions={<CreatePOSheet />} />

      <DataTable
        columns={columns}
        data={orders.data ?? []}
        isLoading={orders.isLoading}
        exportFileName="purchase-orders"
        emptyTitle="لا توجد أوامر شراء بعد"
      />
    </div>
  )
}
