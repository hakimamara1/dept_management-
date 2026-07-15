import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { StatCard } from '@shared/components/StatCard'
import { Wallet } from 'lucide-react'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import type { SupplierTransaction } from '@shared/types/api'
import { usePayments } from '../hooks/usePayments'
import { RecordPaymentDialog } from '../components/RecordPaymentDialog'

const columns: ColumnDef<SupplierTransaction, any>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
    meta: { exportLabel: 'التاريخ' },
    cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>
  },
  {
    accessorKey: 'supplier_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="المورد" />,
    meta: { exportLabel: 'المورد' },
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.supplier_name}</span>
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
    meta: { exportLabel: 'المبلغ' },
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold text-success">{formatCurrency(Math.abs(row.original.amount))}</span>
    )
  },
  {
    accessorKey: 'balance_after',
    header: 'الرصيد بعد الدفعة',
    meta: { exportLabel: 'الرصيد بعد الدفعة' },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatCurrency(row.original.balance_after)}</span>
  },
  {
    accessorKey: 'description',
    header: 'البيان',
    meta: { exportLabel: 'البيان' },
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.description ?? '—'}</span>
  }
]

export function PaymentsPage() {
  const { t } = useI18n()
  const { data, isLoading } = usePayments()

  const totalPaid = (data ?? []).reduce((sum, p) => sum + Math.abs(p.amount), 0)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('nav.payments')} subtitle="سجل كل الدفعات المسجلة عبر جميع الموردين" actions={<RecordPaymentDialog />} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="إجمالي المدفوعات" value={formatCurrency(totalPaid)} loading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        exportFileName="payments"
        emptyTitle="لا توجد دفعات مسجلة بعد"
      />
    </div>
  )
}
