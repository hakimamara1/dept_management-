import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { useExpirationBatch } from '../hooks/useExpirationBatches'
import { useDeleteExpirationBatch, useSetExpirationBatchStatus } from '../hooks/useExpirationMutations'
import { BatchStatusBadge } from '../components/BatchStatusBadge'
import { EditBatchDialog } from '../components/EditBatchDialog'

export function ExpirationBatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const batchId = Number(id)
  const [editing, setEditing] = useState(false)

  const { data: batch, isLoading, error, refetch } = useExpirationBatch(batchId)
  const setStatus = useSetExpirationBatchStatus(batchId)
  const deleteBatch = useDeleteExpirationBatch()

  if (isLoading) return <LoadingState rows={6} />
  if (error || !batch) {
    return <ErrorState message={error?.message ?? 'الدفعة غير موجودة'} onRetry={() => refetch()} />
  }

  const isTerminal = batch.computed_status === 'DISCARDED' || batch.computed_status === 'SOLD'

  function handleDelete() {
    if (!window.confirm('حذف هذه الدفعة نهائياً؟')) return
    deleteBatch.mutate(batchId, { onSuccess: () => navigate('/expiration') })
  }

  return (
    <div className="flex flex-1 flex-col">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/expiration')}>
        <ArrowRight className="size-4" />
        تتبع الصلاحية
      </Button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{batch.product_name}</h1>
            <BatchStatusBadge status={batch.computed_status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">دفعة #{batch.batch_number}</p>
        </div>
        <div className="flex gap-2">
          {!isTerminal && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                تعديل
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus.mutate('SOLD')} disabled={setStatus.isPending}>
                تحديد كمباعة
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus.mutate('DISCARDED')} disabled={setStatus.isPending}>
                تحديد كتالفة
              </Button>
            </>
          )}
          {isTerminal && (
            <Button variant="outline" size="sm" onClick={() => setStatus.mutate('ACTIVE')} disabled={setStatus.isPending}>
              التراجع عن الحالة
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            حذف
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">المنتج</div>
            <div className="font-semibold">{batch.product_name}</div>
            {batch.product_barcode && <div className="text-xs text-muted-foreground">{batch.product_barcode}</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الفئة</div>
            <div className="font-semibold">{batch.product_category ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">رقم الدفعة</div>
            <div className="font-semibold">{batch.batch_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الموقع</div>
            <div className="font-semibold">{batch.location ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">تاريخ التصنيع</div>
            <div className="font-semibold">{formatDate(batch.manufacturing_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">تاريخ انتهاء الصلاحية</div>
            <div className="font-semibold">{formatDate(batch.expiration_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الأيام المتبقية</div>
            <div className={cn('tabular-nums font-semibold', batch.days_remaining < 0 && 'text-destructive')}>
              {batch.days_remaining}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الكمية</div>
            <div className="tabular-nums font-semibold">
              {batch.quantity ?? '—'} {batch.unit ?? batch.product_unit ?? ''}
            </div>
          </div>
          {batch.notes && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs text-muted-foreground">ملاحظات</div>
              <div>{batch.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5">
          <div>
            <div className="text-xs text-muted-foreground">تاريخ التسجيل</div>
            <div className="font-semibold">{formatDate(batch.created_at)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">آخر تعديل</div>
            <div className="font-semibold">{formatDate(batch.updated_at)}</div>
          </div>
        </CardContent>
      </Card>

      <EditBatchDialog batch={editing ? batch : null} onOpenChange={(open) => !open && setEditing(false)} />
    </div>
  )
}
