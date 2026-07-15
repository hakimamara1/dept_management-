import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { DataTable } from '@shared/components/data-table/DataTable'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import type { PurchaseOrderItem, PurchaseOrderStatus } from '@shared/types/api'
import { usePurchaseOrder } from '../hooks/usePurchaseOrders'
import { useUpdatePurchaseOrderStatus } from '../hooks/usePurchaseOrderMutations'

const STATUS_BADGE: Record<PurchaseOrderStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' }> = {
  Draft: { label: 'مسودة', variant: 'secondary' },
  Sent: { label: 'تم الإرسال', variant: 'warning' },
  Received: { label: 'تم الاستلام', variant: 'success' },
  Cancelled: { label: 'ملغي', variant: 'destructive' }
}

const NEXT_ACTIONS: Record<PurchaseOrderStatus, { status: PurchaseOrderStatus; label: string }[]> = {
  Draft: [
    { status: 'Sent', label: 'تحديد كمرسل' },
    { status: 'Cancelled', label: 'إلغاء' }
  ],
  Sent: [
    { status: 'Received', label: 'تحديد كمستلم' },
    { status: 'Cancelled', label: 'إلغاء' }
  ],
  Received: [],
  Cancelled: []
}

const itemColumns: ColumnDef<PurchaseOrderItem, any>[] = [
  { accessorKey: 'product_name', header: 'المنتج', meta: { exportLabel: 'المنتج' } },
  {
    accessorKey: 'quantity',
    header: 'الكمية',
    meta: { exportLabel: 'الكمية' },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {Number(row.original.quantity).toLocaleString('ar-DZ')} {row.original.unit ?? ''}
      </span>
    )
  },
  {
    accessorKey: 'expected_unit_price',
    header: 'السعر المتوقع',
    meta: { exportLabel: 'السعر المتوقع' },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.expected_unit_price)}</span>
  },
  {
    id: 'lineTotal',
    header: 'الإجمالي المتوقع',
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold">
        {formatCurrency(Number(row.original.quantity) * Number(row.original.expected_unit_price ?? 0))}
      </span>
    )
  }
]

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const orderId = Number(id)

  const { data, isLoading, error, refetch } = usePurchaseOrder(orderId)
  const updateStatus = useUpdatePurchaseOrderStatus(orderId)

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'أمر الشراء غير موجود'} onRetry={() => refetch()} />
  }

  const badge = STATUS_BADGE[data.status]
  const actions = NEXT_ACTIONS[data.status]

  return (
    <div className="flex flex-1 flex-col">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/purchase-orders')}>
        <ArrowRight className="size-4" />
        أوامر الشراء
      </Button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">PO-{data.id}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{data.supplier_name}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.status === 'Cancelled' ? 'outline' : 'default'}
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate(action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">تاريخ الطلب</div>
            <div className="font-semibold">{formatDate(data.order_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الاستلام المتوقع</div>
            <div className="font-semibold">{formatDate(data.expected_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">عدد الأصناف</div>
            <div className="font-semibold">{data.item_count}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">القيمة المتوقعة</div>
            <div className="tabular-nums font-semibold">{formatCurrency(data.expected_total)}</div>
          </div>
          {data.notes && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs text-muted-foreground">ملاحظات</div>
              <div>{data.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable columns={itemColumns} data={data.items} exportFileName={`po-${data.id}-items`} />
    </div>
  )
}
