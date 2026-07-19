import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Printer, FileDown } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import type { InvoiceReviewItem } from '@shared/types/api'
import { useInvoiceReview } from '../hooks/useInvoiceReview'

const MATCH_BADGE: Record<string, { label: string; variant: 'success' | 'secondary' }> = {
  Matched: { label: 'مطابق تلقائياً', variant: 'success' },
  UserSelected: { label: 'مختار يدوياً', variant: 'success' },
  NewProduct: { label: 'منتج جديد', variant: 'success' }
}

/**
 * Dedicated read-only page for an Approved invoice — a "printed legal
 * document" view, per the immutability rule in business-rules.md. No save,
 * edit, approve, reject, match, create, or delete control exists anywhere
 * here; this page only ever reads GET /:id/review, it never mutates.
 * Pending Review invoices are redirected to the editable /review page.
 */
export function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invoiceId = Number(id)

  const { data, isLoading, error, refetch } = useInvoiceReview(invoiceId)

  useEffect(() => {
    if (data && data.invoice.status !== 'Approved') {
      navigate(`/invoices/${invoiceId}/review`, { replace: true })
    }
  }, [data, invoiceId, navigate])

  if (isLoading) return <LoadingState rows={6} />
  if (error || !data) {
    return <ErrorState message={error?.message ?? 'الفاتورة غير موجودة'} onRetry={() => refetch()} />
  }
  if (data.invoice.status !== 'Approved') {
    return <LoadingState rows={6} />
  }

  const { invoice, items } = data

  const subtotal = items.reduce((sum, item) => sum + Number(item.total_price), 0)
  const matchedExisting = items.filter((i) => i.match_status === 'Matched' || i.match_status === 'UserSelected').length
  const newProducts = items.filter((i) => i.match_status === 'NewProduct').length
  const matchedItems = matchedExisting + newProducts
  const confidences = items.map((i) => i.match_confidence).filter((c): c is number => c != null)
  const avgConfidence = confidences.length ? confidences.reduce((s, c) => s + c, 0) / confidences.length : null

  const columns: ColumnDef<InvoiceReviewItem, any>[] = [
    {
      accessorKey: 'line_number',
      header: '#',
      meta: { exportLabel: '#' },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.line_number}</span>
    },
    {
      accessorKey: 'ocr_product_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم الصنف" />,
      meta: { exportLabel: 'اسم الصنف' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.ocr_product_name}</span>
    },
    {
      accessorKey: 'matched_product_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المنتج المطابق" />,
      meta: { exportLabel: 'المنتج المطابق' },
      cell: ({ row }) => row.original.matched_product_name ?? '—'
    },
    {
      accessorKey: 'unit',
      header: 'الوحدة',
      meta: { exportLabel: 'الوحدة' },
      cell: ({ row }) => row.original.unit ?? '—'
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الكمية" />,
      meta: { exportLabel: 'الكمية' },
      cell: ({ row }) => <span className="tabular-nums">{Number(row.original.quantity).toLocaleString('ar-DZ')}</span>
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => <DataTableColumnHeader column={column} title="سعر الوحدة" />,
      meta: { exportLabel: 'سعر الوحدة' },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.unit_price)}</span>
    },
    {
      accessorKey: 'total_price',
      header: ({ column }) => <DataTableColumnHeader column={column} title="إجمالي السطر" />,
      meta: { exportLabel: 'إجمالي السطر' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.total_price)}</span>
    },
    {
      accessorKey: 'match_status',
      header: 'حالة المطابقة',
      meta: { exportLabel: 'حالة المطابقة' },
      cell: ({ row }) => {
        const badge = MATCH_BADGE[row.original.match_status] ?? { label: row.original.match_status, variant: 'secondary' as const }
        return <Badge variant={badge.variant}>{badge.label}</Badge>
      }
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <Button variant="ghost" size="sm" className="mb-2 w-fit print:hidden" onClick={() => navigate('/invoices')}>
        <ArrowRight className="size-4" />
        الفواتير
      </Button>

      {/* Invoice Header */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">رقم الفاتورة</div>
            <div className="font-semibold">#{invoice.invoice_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المورد</div>
            <Link to={`/suppliers/${invoice.supplier_id}`} className="font-semibold text-primary hover:underline print:text-foreground print:no-underline">
              {invoice.supplier_name}
            </Link>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">تاريخ الفاتورة</div>
            <div className="font-semibold">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">تاريخ الاعتماد</div>
            <div className="font-semibold">{invoice.approved_at ? formatDate(invoice.approved_at) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الحالة</div>
            <Badge variant="success">معتمدة</Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المبلغ الإجمالي</div>
            <div className="tabular-nums font-semibold">{formatCurrency(invoice.invoice_amount)}</div>
          </div>
          {avgConfidence != null && (
            <div>
              <div className="text-xs text-muted-foreground">دقة المطابقة (OCR)</div>
              <div className="tabular-nums font-semibold">{Math.round(avgConfidence * 100)}%</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Items — fully read-only */}
      <DataTable
        columns={columns}
        data={items}
        pageSize={50}
        exportFileName={`invoice-${invoice.invoice_number}`}
        emptyTitle="لا توجد أصناف"
        toolbar={<div className="text-sm text-muted-foreground">{items.length} صنف</div>}
      />

      {/* Invoice Summary */}
      <Card className="mt-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <div className="text-xs text-muted-foreground">المجموع الفرعي</div>
            <div className="tabular-nums font-semibold">{formatCurrency(subtotal)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المبلغ الإجمالي (المحسوب)</div>
            <div className="tabular-nums font-semibold">{formatCurrency(invoice.invoice_amount)}</div>
          </div>
          {invoice.ocr_header_total != null && (
            <>
              <div>
                <div className="text-xs text-muted-foreground">إجمالي رأس الفاتورة (OCR)</div>
                <div className="tabular-nums font-semibold">{formatCurrency(invoice.ocr_header_total)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الفرق عن OCR</div>
                <div className="tabular-nums font-semibold">
                  {formatCurrency(invoice.invoice_amount - invoice.ocr_header_total)}
                </div>
              </div>
            </>
          )}
          <div>
            <div className="text-xs text-muted-foreground">عدد الأصناف</div>
            <div className="tabular-nums font-semibold">{items.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">أصناف مطابقة</div>
            <div className="tabular-nums font-semibold">{matchedItems}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">منتجات جديدة أُنشئت</div>
            <div className="tabular-nums font-semibold">{newProducts}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">منتجات مطابقة لمنتج موجود</div>
            <div className="tabular-nums font-semibold">{matchedExisting}</div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Information */}
      <Card className="mt-6 print:hidden">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">اسم المورد</div>
            <div className="font-semibold">{invoice.supplier_name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">رقم الفاتورة</div>
            <div className="font-semibold">#{invoice.invoice_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الرصيد الحالي للمورد</div>
            <div className="tabular-nums font-semibold">{formatCurrency(invoice.current_balance)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions — view/print only, nothing that mutates */}
      <div className="mt-6 flex justify-end gap-2 print:hidden">
        <Button type="button" variant="ghost" onClick={() => navigate('/invoices')}>
          رجوع
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <FileDown className="size-4" />
          تصدير PDF
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </Button>
      </div>
    </div>
  )
}
