import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Printer } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { Textarea } from '@shared/components/ui/textarea'
import { Badge } from '@shared/components/ui/badge'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useInvoiceReview } from '../hooks/useInvoiceReview'
import { useApproveInvoice, useUpdateInvoiceNotes } from '../hooks/useInvoiceMutations'
import { InvoiceItemsTable } from '../components/InvoiceItemsTable'

export function InvoiceReviewPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invoiceId = Number(id)

  const { data, isLoading, error, refetch } = useInvoiceReview(invoiceId)
  const approveInvoice = useApproveInvoice(invoiceId)
  const updateNotes = useUpdateInvoiceNotes(invoiceId)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'الفاتورة غير موجودة'} onRetry={() => refetch()} />
  }

  const { invoice, items } = data
  const isPending = invoice.status === 'Pending Review'

  let validationErrors: string[] = []
  try {
    validationErrors = invoice.validation_errors ? JSON.parse(invoice.validation_errors).map((e: any) => e.message ?? String(e)) : []
  } catch {
    validationErrors = []
  }

  function handleApprove() {
    approveInvoice.mutate(undefined, { onSuccess: () => navigate('/invoices') })
  }

  function handleSaveNotes() {
    if (notesDraft == null) return
    updateNotes.mutate(notesDraft, { onSuccess: () => setNotesDraft(null) })
  }

  return (
    <div className="flex flex-1 flex-col pb-20">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/invoices')}>
        <ArrowRight className="size-4" />
        {t('invoices.title')}
      </Button>

      <Card className="mb-6 print:hidden">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
          <div>
            <div className="text-xs text-muted-foreground">رقم الفاتورة</div>
            <div className="flex items-center gap-2 font-semibold">
              #{invoice.invoice_number}
              <Badge variant={isPending ? 'warning' : 'success'}>{isPending ? 'قيد المراجعة' : 'معتمدة'}</Badge>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المورد</div>
            <Link to={`/suppliers/${invoice.supplier_id}`} className="font-semibold text-primary hover:underline">
              {invoice.supplier_name}
            </Link>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">التاريخ</div>
            <div className="font-semibold">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">مبلغ الفاتورة</div>
            <div className="tabular-nums font-semibold">{formatCurrency(invoice.invoice_amount)}</div>
          </div>
          {!isPending && (
            <div className="flex items-start justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="size-3.5" />
                طباعة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {validationErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4 print:hidden">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="size-4" />
            ملاحظات على البيانات المستخرجة
          </div>
          <ul className="ms-6 list-disc text-sm text-muted-foreground">
            {validationErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {isPending && (
        <p className="mb-4 text-sm text-muted-foreground">
          الفاتورة قيد المراجعة — عدّل أي حقل، طابق أو أنشئ منتجات، ثم اعتمد الفاتورة. لا شيء من هذا يؤثر على المخزون أو
          الديون حتى الاعتماد.
        </p>
      )}

      <InvoiceItemsTable invoiceId={invoiceId} items={items} readOnly={!isPending} />

      {!isPending && (
        <Card className="mt-6 print:hidden">
          <CardContent className="space-y-2 p-5">
            <div className="text-sm font-medium">ملاحظات</div>
            <Textarea
              rows={2}
              placeholder="اختياري"
              value={notesDraft ?? invoice.notes ?? ''}
              onChange={(e) => setNotesDraft(e.target.value)}
            />
            {notesDraft != null && notesDraft !== (invoice.notes ?? '') && (
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleSaveNotes} disabled={updateNotes.isPending}>
                  {updateNotes.isPending ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isPending && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <span className="text-sm text-muted-foreground">{items.length} صنف — راجع كل صنف قبل الاعتماد</span>
            <Button onClick={handleApprove} disabled={approveInvoice.isPending}>
              {approveInvoice.isPending ? t('common.loading') : t('invoices.approve')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
