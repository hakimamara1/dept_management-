import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Printer } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useCustomerInvoice } from '../hooks/useCustomerInvoices'

export function SalesInvoiceDetailPage() {
  const { t } = useI18n()
  const { id, invoiceId } = useParams<{ id: string; invoiceId: string }>()
  const navigate = useNavigate()
  const customerId = Number(id)
  const salesInvoiceId = Number(invoiceId)

  const { data, isLoading, error, refetch } = useCustomerInvoice(customerId, salesInvoiceId)

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'الفاتورة غير موجودة'} onRetry={() => refetch()} />
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

      <Card className="mx-auto w-full max-w-2xl print:border-none print:shadow-none">
        <CardContent className="p-8">
          <div className="mb-6 flex items-start justify-between border-b border-border pb-6">
            <div>
              <div className="text-lg font-semibold text-foreground">فاتورة بيع جملة</div>
              <div className="mt-1 text-sm text-muted-foreground">{data.invoice_number}</div>
            </div>
            <div className="text-end text-sm text-muted-foreground">
              <div>{formatDate(data.invoice_date)}</div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">العميل</div>
              <div className="font-medium text-foreground">{data.customer_name}</div>
            </div>
            {data.customer_phone && (
              <div>
                <div className="text-xs text-muted-foreground">الهاتف</div>
                <div className="font-medium text-foreground">{data.customer_phone}</div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="py-2 text-start">الصنف</th>
                  <th className="py-2 text-start">الكمية</th>
                  <th className="py-2 text-start">الوحدة</th>
                  <th className="py-2 text-start">سعر الوحدة</th>
                  <th className="py-2 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-foreground">{item.product_name}</td>
                    <td className="tabular-nums py-2">{Number(item.quantity).toLocaleString('ar-DZ')}</td>
                    <td className="py-2">{item.unit ?? '—'}</td>
                    <td className="tabular-nums py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="tabular-nums py-2 font-medium">{formatCurrency(item.line_total)}</td>
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

          <div className="mt-6 space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('customers.previousBalance')}</span>
              <span className="tabular-nums">{formatCurrency(data.previous_balance)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t('customers.invoiceAmount')}</span>
              <span className="tabular-nums">{formatCurrency(data.invoice_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
              <span>{t('customers.newBalance')}</span>
              <span className="tabular-nums">{formatCurrency(data.new_balance)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
