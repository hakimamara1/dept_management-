import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Printer, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { Textarea } from '@shared/components/ui/textarea'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { API_BASE_URL } from '@shared/lib/api-client'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useBusinessProfile } from '@modules/settings'
import { useCustomerInvoice } from '../hooks/useCustomerInvoices'
import { useApproveSalesInvoice, useDeleteSalesInvoice, useUpdateSalesInvoiceNotes } from '../hooks/useSalesInvoiceMutations'
import { SalesInvoiceItemsTable } from '../components/SalesInvoiceItemsTable'

export function SalesInvoiceDetailPage() {
  const { t } = useI18n()
  const { id, invoiceId } = useParams<{ id: string; invoiceId: string }>()
  const navigate = useNavigate()
  const customerId = Number(id)
  const salesInvoiceId = Number(invoiceId)

  const { data, isLoading, error, refetch } = useCustomerInvoice(customerId, salesInvoiceId)
  const { data: profile } = useBusinessProfile()
  const approveInvoice = useApproveSalesInvoice(customerId, salesInvoiceId)
  const deleteInvoice = useDeleteSalesInvoice(customerId)
  const updateNotes = useUpdateSalesInvoiceNotes(customerId, salesInvoiceId)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'الفاتورة غير موجودة'} onRetry={() => refetch()} />
  }

  const hasProfile = profile && (profile.business_name || profile.address || profile.phone || profile.tax_number || profile.commercial_register)

  function handleDeleteDraft() {
    if (!window.confirm('حذف المسودة نهائياً بكل أصنافها؟ لا يمكن التراجع عن هذا.')) return
    deleteInvoice.mutate(salesInvoiceId, { onSuccess: () => navigate(`/customers/${customerId}`) })
  }

  function handleSaveNotes() {
    if (notesDraft == null) return
    updateNotes.mutate(notesDraft, { onSuccess: () => setNotesDraft(null) })
  }

  if (data.status === 'Draft') {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(`/customers/${customerId}`)}>
            <ArrowRight className="size-4" />
            {data.customer_name}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteDraft}
              disabled={deleteInvoice.isPending}
            >
              <Trash2 className="size-4" />
              حذف المسودة
            </Button>
            <Button size="sm" onClick={() => approveInvoice.mutate()} disabled={approveInvoice.isPending}>
              <Check className="size-4" />
              {approveInvoice.isPending ? 'جاري الاعتماد...' : 'اعتماد الفاتورة'}
            </Button>
          </div>
        </div>

        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="flex flex-col gap-4 p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">{data.invoice_number}</span>
                <Badge variant="warning">مسودة</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {data.customer_name} — {formatDate(data.invoice_date)}
              </div>
            </div>

            <SalesInvoiceItemsTable customerId={customerId} invoiceId={salesInvoiceId} items={data.items} />

            <div>
              <label className="text-xs text-muted-foreground">ملاحظات</label>
              <Textarea
                rows={2}
                value={notesDraft ?? data.notes ?? ''}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="اختياري"
              />
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 rounded-md border border-border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('customers.previousBalance')} (معاينة)</span>
                  <span className="tabular-nums">{formatCurrency(data.previous_balance)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('customers.invoiceAmount')}</span>
                  <span className="tabular-nums">{formatCurrency(data.invoice_amount)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-foreground">
                  <span>{t('customers.newBalance')} (معاينة)</span>
                  <span className="tabular-nums">{formatCurrency(data.new_balance)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(`/customers/${customerId}`)}>
          <ArrowRight className="size-4" />
          {data.customer_name}
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          {t('customers.print')}
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl print:w-full print:max-w-none print:border-none print:shadow-none">
        <CardContent className="p-8">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between gap-6 border-b border-border pb-6">
            <div className="flex items-start gap-3">
              {profile?.logo_path && (
                <img
                  src={`${API_BASE_URL}/uploads/${profile.logo_path}`}
                  alt="شعار الشركة"
                  className="size-14 shrink-0 rounded-md object-contain"
                />
              )}
              {hasProfile ? (
                <div>
                  {profile?.business_name && <div className="text-lg font-bold text-foreground">{profile.business_name}</div>}
                  <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                    {profile?.address && <div>{profile.address}</div>}
                    {profile?.phone && <div>{profile.phone}</div>}
                    {(profile?.tax_number || profile?.commercial_register) && (
                      <div>
                        {profile.tax_number && <span>الرقم الضريبي: {profile.tax_number}</span>}
                        {profile.tax_number && profile.commercial_register && ' — '}
                        {profile.commercial_register && <span>السجل التجاري: {profile.commercial_register}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-semibold text-foreground">فاتورة بيع جملة</div>
              )}
            </div>
            <div className="text-end text-sm">
              <div className="font-semibold text-foreground">فاتورة بيع</div>
              <div className="mt-1 text-muted-foreground">{data.invoice_number}</div>
              <div className="text-muted-foreground">{formatDate(data.invoice_date)}</div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">الفاتورة إلى</div>
              <div className="font-medium text-foreground">{data.customer_name}</div>
            </div>
            {data.customer_phone && (
              <div>
                <div className="text-xs text-muted-foreground">الهاتف</div>
                <div className="font-medium text-foreground">{data.customer_phone}</div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-start text-xs text-muted-foreground">
                  <th className="py-2 ps-3 text-start">#</th>
                  <th className="py-2 text-start">الصنف</th>
                  <th className="py-2 text-start">الكمية</th>
                  <th className="py-2 text-start">الوحدة</th>
                  <th className="py-2 text-start">سعر الوحدة</th>
                  <th className="py-2 pe-3 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 ps-3 text-muted-foreground">{index + 1}</td>
                    <td className="py-2 font-medium text-foreground">{item.product_name}</td>
                    <td className="tabular-nums py-2">{Number(item.quantity).toLocaleString('ar-DZ')}</td>
                    <td className="py-2">{item.unit ?? '—'}</td>
                    <td className="tabular-nums py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="tabular-nums py-2 pe-3 font-medium">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.notes && (
            <div className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">ملاحظات: </span>
              {data.notes}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 rounded-md border border-border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('customers.previousBalance')}</span>
                <span className="tabular-nums">{formatCurrency(data.previous_balance)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('customers.invoiceAmount')}</span>
                <span className="tabular-nums">{formatCurrency(data.invoice_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-foreground">
                <span>{t('customers.newBalance')}</span>
                <span className="tabular-nums">{formatCurrency(data.new_balance)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-16 grid grid-cols-2 gap-8 text-sm text-muted-foreground">
            <div>
              <div className="border-t border-border pt-2 text-center">توقيع المستلم</div>
            </div>
            <div>
              <div className="border-t border-border pt-2 text-center">ختم المؤسسة</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
