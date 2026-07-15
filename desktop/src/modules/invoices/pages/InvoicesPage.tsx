import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import type { ApprovedInvoice, PendingInvoice } from '@shared/types/api'
import { useApprovedInvoices, usePendingInvoices } from '../hooks/useInvoices'
import { SubmitInvoiceDialog } from '../components/SubmitInvoiceDialog'

type SubTab = 'pending' | 'approved'

export function InvoicesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<SubTab>('pending')

  const pending = usePendingInvoices()
  const approved = useApprovedInvoices()

  const pendingColumns: ColumnDef<PendingInvoice, any>[] = [
    {
      accessorKey: 'invoice_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="رقم الفاتورة" />,
      meta: { exportLabel: 'رقم الفاتورة' },
      cell: ({ row }) => <span className="font-medium text-foreground">#{row.original.invoice_number}</span>
    },
    {
      accessorKey: 'supplier_name',
      header: 'المورد',
      meta: { exportLabel: 'المورد' }
    },
    {
      accessorKey: 'invoice_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.invoice_date)}</span>
    },
    {
      accessorKey: 'invoice_amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
      meta: { exportLabel: 'المبلغ' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.invoice_amount)}</span>
    },
    {
      id: 'items',
      header: 'الأصناف',
      cell: ({ row }) => (
        <Badge variant={row.original.pending_items > 0 ? 'warning' : 'secondary'}>
          {row.original.pending_items} من {row.original.total_items} بحاجة مطابقة
        </Badge>
      )
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${row.original.id}/review`)}>
          {t('invoices.review')}
        </Button>
      )
    }
  ]

  const approvedColumns: ColumnDef<ApprovedInvoice, any>[] = [
    {
      accessorKey: 'invoice_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="رقم الفاتورة" />,
      meta: { exportLabel: 'رقم الفاتورة' },
      cell: ({ row }) => <span className="font-medium text-foreground">#{row.original.invoice_number}</span>
    },
    { accessorKey: 'supplier_name', header: 'المورد', meta: { exportLabel: 'المورد' } },
    {
      accessorKey: 'invoice_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.invoice_date)}</span>
    },
    {
      accessorKey: 'invoice_amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
      meta: { exportLabel: 'المبلغ' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.invoice_amount)}</span>
    },
    {
      id: 'status',
      header: 'الحالة',
      cell: () => <Badge variant="success">معتمدة</Badge>
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('invoices.title')} subtitle={t('invoices.subtitle')} actions={<SubmitInvoiceDialog />} />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'pending' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('pending')}>
          {t('invoices.pendingTab')}
          {pending.data && pending.data.length > 0 && (
            <Badge variant="warning" className="ms-1">
              {pending.data.length}
            </Badge>
          )}
        </Button>
        <Button variant={tab === 'approved' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('approved')}>
          {t('invoices.approvedTab')}
        </Button>
      </div>

      {tab === 'pending' ? (
        <DataTable
          columns={pendingColumns}
          data={pending.data ?? []}
          isLoading={pending.isLoading}
          exportFileName="pending-invoices"
          emptyTitle="لا توجد فواتير معلقة حالياً"
        />
      ) : (
        <DataTable
          columns={approvedColumns}
          data={approved.data ?? []}
          isLoading={approved.isLoading}
          exportFileName="approved-invoices"
          emptyTitle="لا توجد فواتير معتمدة بعد"
        />
      )}
    </div>
  )
}
