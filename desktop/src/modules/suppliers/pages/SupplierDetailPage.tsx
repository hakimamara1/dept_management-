import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, FileText, Receipt, Scale, Wallet } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { StatCard } from '@shared/components/StatCard'
import { PageHeader } from '@shared/components/PageHeader'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import type { SupplierTransaction, SupplierTransactionType } from '@shared/types/api'
import { useSupplierAging } from '../hooks/useSuppliers'
import { useSupplier, useSupplierLedger } from '../hooks/useSupplierDetail'
import { RecordPaymentDialog } from '../components/RecordPaymentDialog'
import { AdjustBalanceDialog } from '../components/AdjustBalanceDialog'
import { DeleteSupplierDialog } from '../components/DeleteSupplierDialog'

const TYPE_BADGE: Record<SupplierTransactionType, { label: string; variant: 'destructive' | 'success' | 'secondary' }> = {
  invoice: { label: 'فاتورة', variant: 'destructive' },
  payment: { label: 'دفعة', variant: 'success' },
  adjustment: { label: 'تسوية', variant: 'secondary' }
}

function buildLedgerColumns(navigate: ReturnType<typeof useNavigate>): ColumnDef<SupplierTransaction, any>[] {
  return [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
    meta: { exportLabel: 'التاريخ' },
    cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>
  },
  {
    accessorKey: 'transaction_type',
    header: 'النوع',
    meta: { exportLabel: 'النوع' },
    cell: ({ row }) => {
      const badge = TYPE_BADGE[row.original.transaction_type]
      return <Badge variant={badge.variant}>{badge.label}</Badge>
    }
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
    meta: { exportLabel: 'المبلغ' },
    cell: ({ row }) => {
      const amount = Number(row.original.amount)
      return (
        <span className={cn('tabular-nums font-medium', amount > 0 ? 'text-destructive' : 'text-success')}>
          {amount > 0 ? '+' : ''}
          {formatCurrency(amount)}
        </span>
      )
    }
  },
  {
    accessorKey: 'balance_after',
    header: 'الرصيد بعد العملية',
    meta: { exportLabel: 'الرصيد بعد العملية' },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.balance_after)}</span>
  },
  {
    accessorKey: 'description',
    header: 'البيان',
    meta: { exportLabel: 'البيان' },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.invoice_id != null && (
          <button
            type="button"
            onClick={() => navigate(`/invoices/${row.original.invoice_id}`)}
            className="me-1 inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Receipt className="size-3" />
            فاتورة #{row.original.invoice_number}
          </button>
        )}
        {row.original.invoice_id != null ? ' — ' : ''}
        {row.original.description ?? '—'}
      </span>
    )
  }
  ]
}

export function SupplierDetailPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const supplierId = Number(id)

  const supplier = useSupplier(supplierId)
  const ledger = useSupplierLedger(supplierId)
  const aging = useSupplierAging()

  const agingRow = useMemo(() => aging.data?.find((a) => a.id === supplierId), [aging.data, supplierId])

  if (supplier.isLoading) return <LoadingState rows={6} />
  if (supplier.error || !supplier.data) {
    return <ErrorState message={supplier.error?.message ?? 'المورد غير موجود'} onRetry={() => supplier.refetch()} />
  }

  const balance = Number(supplier.data.current_balance)
  const ledgerColumns = buildLedgerColumns(navigate)

  return (
    <div className="flex flex-1 flex-col">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/suppliers')}>
        <ArrowRight className="size-4" />
        الموردون
      </Button>

      <PageHeader
        title={supplier.data.name}
        subtitle={supplier.data.phone ?? undefined}
        actions={
          <>
            <DeleteSupplierDialog supplierId={supplierId} supplierName={supplier.data.name} balance={balance} />
            <AdjustBalanceDialog supplierId={supplierId} />
            <RecordPaymentDialog supplierId={supplierId} currentBalance={balance} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Wallet} label={t('suppliers.currentBalance')} value={formatCurrency(balance)} />
        <StatCard icon={FileText} label="0-30 يوم" value={formatCurrency(agingRow?._0_30 ?? 0)} loading={aging.isLoading} />
        <StatCard icon={FileText} label="30-60 يوم" value={formatCurrency(agingRow?._30_60 ?? 0)} loading={aging.isLoading} />
        <StatCard icon={FileText} label="60-90 يوم" value={formatCurrency(agingRow?._60_90 ?? 0)} loading={aging.isLoading} />
        <StatCard icon={Scale} label="+90 يوم" value={formatCurrency(agingRow?._90_plus ?? 0)} loading={aging.isLoading} />
      </div>

      <DataTable
        columns={ledgerColumns}
        data={ledger.data ?? []}
        isLoading={ledger.isLoading}
        exportFileName={`supplier-${supplierId}-ledger`}
        emptyTitle="لا توجد حركات مسجلة لهذا المورد"
      />
    </div>
  )
}
