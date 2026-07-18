import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { SupplierPicker, type PickedSupplier } from '@shared/components/SupplierPicker'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import type { PurchaseOrderStatus } from '@shared/types/api'
import { usePurchaseOrder } from '../hooks/usePurchaseOrders'
import { useUpdatePurchaseOrder, useUpdatePurchaseOrderStatus } from '../hooks/usePurchaseOrderMutations'
import { PurchaseOrderItemsTable } from '../components/PurchaseOrderItemsTable'

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

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const orderId = Number(id)

  const { data, isLoading, error, refetch } = usePurchaseOrder(orderId)
  const updateStatus = useUpdatePurchaseOrderStatus(orderId)
  const updateOrder = useUpdatePurchaseOrder(orderId)

  const [orderDate, setOrderDate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'أمر الشراء غير موجود'} onRetry={() => refetch()} />
  }

  const badge = STATUS_BADGE[data.status]
  const actions = NEXT_ACTIONS[data.status]
  const isDraft = data.status === 'Draft'

  const currentOrderDate = orderDate || data.order_date.slice(0, 10)
  const currentExpectedDate = expectedDate || (data.expected_date ? data.expected_date.slice(0, 10) : '')
  const currentNotes = notes || data.notes || ''

  function saveHeaderField(field: 'orderDate' | 'expectedDate' | 'notes', value: string) {
    if (field === 'orderDate' && value === data!.order_date.slice(0, 10)) return
    if (field === 'expectedDate' && value === (data!.expected_date ? data!.expected_date.slice(0, 10) : '')) return
    if (field === 'notes' && value === (data!.notes || '')) return
    updateOrder.mutate({ [field]: value || undefined })
  }

  function handleSupplierChange(supplier: PickedSupplier | null) {
    if (supplier) updateOrder.mutate({ supplierId: supplier.id })
  }

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
          {isDraft ? (
            <div className="mt-1 w-64">
              <SupplierPicker
                value={{ id: data.supplier_id, name: data.supplier_name }}
                onChange={handleSupplierChange}
              />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{data.supplier_name}</p>
          )}
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
          {isDraft ? (
            <>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">تاريخ الطلب</div>
                <Input
                  type="date"
                  value={currentOrderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  onBlur={(e) => saveHeaderField('orderDate', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">الاستلام المتوقع</div>
                <Input
                  type="date"
                  value={currentExpectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  onBlur={(e) => saveHeaderField('expectedDate', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">عدد الأصناف</div>
                <div className="font-semibold">{data.item_count}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">القيمة المتوقعة</div>
                <div className="tabular-nums font-semibold">{formatCurrency(data.expected_total)}</div>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <div className="mb-1 text-xs text-muted-foreground">ملاحظات</div>
                <Textarea
                  rows={2}
                  placeholder="اختياري"
                  value={currentNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={(e) => saveHeaderField('notes', e.target.value)}
                  className="text-xs"
                />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      <PurchaseOrderItemsTable orderId={data.id} items={data.items} readOnly={!isDraft} />
    </div>
  )
}
