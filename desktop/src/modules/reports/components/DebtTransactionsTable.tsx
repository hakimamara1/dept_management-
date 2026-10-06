import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Receipt } from 'lucide-react'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { DebtAnalysis, DebtTransaction } from '@shared/types/api'

const TYPE_BADGE: Record<DebtTransaction['type'], { label: string; variant: 'destructive' | 'success' | 'secondary' }> = {
  invoice: { label: 'فاتورة', variant: 'destructive' },
  payment: { label: 'دفعة', variant: 'success' },
  adjustment: { label: 'تسوية', variant: 'secondary' }
}

export function DebtTransactionsTable({ data }: { data: DebtAnalysis }) {
  const navigate = useNavigate()
  const showEntity = !data.entity

  const columns: ColumnDef<DebtTransaction, any>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.date)}</span>
    },
    ...(showEntity
      ? [{
          accessorKey: 'entityName',
          header: ({ column }: any) => <DataTableColumnHeader column={column} title={data.scope === 'suppliers' ? 'المورد' : 'العميل'} />,
          meta: { exportLabel: data.scope === 'suppliers' ? 'المورد' : 'العميل' },
          cell: ({ row }: any) => <span className="font-medium text-foreground">{row.original.entityName}</span>
        } as ColumnDef<DebtTransaction, any>]
      : []),
    {
      accessorKey: 'type',
      header: 'النوع',
      meta: { exportLabel: 'النوع' },
      cell: ({ row }) => {
        const b = TYPE_BADGE[row.original.type]
        return <Badge variant={b.variant}>{b.label}</Badge>
      }
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
      meta: { exportLabel: 'المبلغ' },
      cell: ({ row }) => {
        const a = row.original.amount
        return (
          <span className={cn('tabular-nums font-medium', a > 0 ? 'text-destructive' : 'text-success')}>
            {a > 0 ? '+' : ''}{formatCurrency(a)}
          </span>
        )
      }
    },
    {
      accessorKey: 'balanceAfter',
      header: 'الرصيد بعد الحركة',
      meta: { exportLabel: 'الرصيد بعد الحركة' },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.balanceAfter)}</span>
    },
    {
      id: 'details',
      header: 'البيان',
      meta: { exportLabel: 'البيان' },
      cell: ({ row }) => {
        const t = row.original
        const link = t.invoiceId != null
          ? data.scope === 'suppliers' ? `/invoices/${t.invoiceId}` : `/customers/${t.entityId}/invoices/${t.invoiceId}`
          : null
        return (
          <span className="text-muted-foreground">
            {link && (
              <button type="button" onClick={() => navigate(link)} className="me-1 inline-flex items-center gap-1 text-primary hover:underline">
                <Receipt className="size-3" />
                فاتورة #{t.reference}
              </button>
            )}
            {link && t.note ? ' — ' : ''}
            {t.note ?? (link ? '' : '—')}
          </span>
        )
      }
    }
  ]

  return (
    <div className="flex flex-col gap-2">
      {data.transactionsTruncated && (
        <p className="text-xs text-muted-foreground">يُعرض آخر 1000 حركة فقط — ضيّق الفترة لرؤية الباقي.</p>
      )}
      <DataTable
        columns={columns}
        data={data.transactions}
        exportFileName="debt-transactions"
        pageSize={15}
        emptyTitle="لا توجد حركات في هذه الفترة"
      />
    </div>
  )
}
