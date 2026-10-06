import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useDateRange } from '@shared/hooks/useDateRange'
import type { PickedSupplier } from '@shared/components/SupplierPicker'
import { useI18n } from '@shared/lib/i18n'
import type { SupplierTransaction } from '@shared/types/api'
import { useState } from 'react'
import { usePaymentAnalytics, usePayments } from '../hooks/usePayments'
import { RecordPaymentDialog } from '../components/RecordPaymentDialog'
import { PaymentFilters } from '../components/PaymentFilters'
import { PaymentKpiGrid } from '../components/PaymentKpiGrid'
import { PaymentsTimeChart } from '../components/PaymentsTimeChart'
import { CashFlowSection } from '../components/CashFlowSection'

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
  const { range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, isCustomReady } = useDateRange()
  const [supplier, setSupplier] = useState<PickedSupplier | null>(null)

  const filters = {
    range,
    from: range === 'custom' ? customFrom : undefined,
    to: range === 'custom' ? customTo : undefined,
    supplierId: supplier?.id ?? null
  }
  // A custom range with a missing date would make the backend query nonsense.
  const analytics = usePaymentAnalytics(filters, isCustomReady)
  const payments = usePayments(filters, isCustomReady)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('nav.payments')} subtitle="تحليل المدفوعات للموردين وسجل كل الدفعات" actions={<RecordPaymentDialog />} />

      <PaymentFilters
        range={range}
        onRangeChange={setRange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        supplier={supplier}
        onSupplierChange={setSupplier}
      />

      <div className="flex flex-col gap-6">
        <PaymentKpiGrid data={analytics.data} isLoading={analytics.isLoading} />
        <PaymentsTimeChart data={analytics.data} isLoading={analytics.isLoading} />
        <CashFlowSection data={analytics.data} isLoading={analytics.isLoading} />

        <DataTable
          columns={columns}
          data={payments.data ?? []}
          isLoading={payments.isLoading}
          exportFileName="payments"
          emptyTitle="لا توجد دفعات في هذه الفترة"
        />
      </div>
    </div>
  )
}
