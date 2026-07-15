import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import type { InvoiceDecision } from '@shared/types/api'
import { useInvoiceReview } from '../hooks/useInvoiceReview'
import { useApproveInvoice } from '../hooks/useInvoiceMutations'
import { InvoiceLineItem } from '../components/InvoiceLineItem'

export function InvoiceReviewPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invoiceId = Number(id)

  const { data, isLoading, error, refetch } = useInvoiceReview(invoiceId)
  const approveInvoice = useApproveInvoice(invoiceId)
  const [decisions, setDecisions] = useState<Record<number, InvoiceDecision>>({})

  const unresolvedItems = useMemo(
    () => (data?.items ?? []).filter((i) => i.match_status !== 'Matched' && i.match_status !== 'UserSelected'),
    [data?.items]
  )
  const allResolved = unresolvedItems.every((i) => decisions[i.id] != null)

  function handleDecide(itemId: number, decision: InvoiceDecision | null) {
    setDecisions((prev) => {
      const next = { ...prev }
      if (decision) next[itemId] = decision
      else delete next[itemId]
      return next
    })
  }

  function handleApprove() {
    approveInvoice.mutate(Object.values(decisions), {
      onSuccess: () => navigate('/invoices')
    })
  }

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'الفاتورة غير موجودة'} onRetry={() => refetch()} />
  }

  const { invoice, items } = data
  let validationErrors: string[] = []
  try {
    validationErrors = invoice.validation_errors ? JSON.parse(invoice.validation_errors).map((e: any) => e.message ?? String(e)) : []
  } catch {
    validationErrors = []
  }

  return (
    <div className="flex flex-1 flex-col pb-20">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/invoices')}>
        <ArrowRight className="size-4" />
        {t('invoices.title')}
      </Button>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">رقم الفاتورة</div>
            <div className="font-semibold">#{invoice.invoice_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المورد</div>
            <div className="font-semibold">{invoice.supplier_name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">التاريخ</div>
            <div className="font-semibold">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">مبلغ الفاتورة</div>
            <div className="tabular-nums font-semibold">{formatCurrency(invoice.invoice_amount)}</div>
          </div>
        </CardContent>
      </Card>

      {validationErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
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

      <div className="space-y-3">
        {items.map((item) => (
          <InvoiceLineItem
            key={item.id}
            item={item}
            decision={decisions[item.id] ?? null}
            onDecide={(decision) => handleDecide(item.id, decision)}
          />
        ))}
      </div>

      {invoice.status === 'Pending Review' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <span className="text-sm text-muted-foreground">
              {unresolvedItems.length === 0
                ? 'كل الأصناف مطابقة'
                : `${Object.keys(decisions).length} من ${unresolvedItems.length} أصناف تم حسمها`}
            </span>
            <Button onClick={handleApprove} disabled={!allResolved || approveInvoice.isPending}>
              {approveInvoice.isPending ? t('common.loading') : t('invoices.approve')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
