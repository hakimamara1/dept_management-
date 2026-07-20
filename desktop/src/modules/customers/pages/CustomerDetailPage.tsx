import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Calendar, FileText, Wallet } from 'lucide-react'
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
import type { CustomerPayment, CustomerStatementEntry, SalesInvoiceListItem } from '@shared/types/api'
import { useCustomer } from '../hooks/useCustomerDetail'
import { useCustomerInvoices } from '../hooks/useCustomerInvoices'
import { useCustomerPayments } from '../hooks/useCustomerPayments'
import { useCustomerStatement } from '../hooks/useCustomerStatement'
import { CreateSalesInvoiceSheet } from '../components/CreateSalesInvoiceSheet'
import { RecordCustomerPaymentDialog } from '../components/RecordCustomerPaymentDialog'
import { AdjustCustomerBalanceDialog } from '../components/AdjustCustomerBalanceDialog'

type SubTab = 'invoices' | 'payments' | 'statement'

export function CustomerDetailPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const customerId = Number(id)
  const [tab, setTab] = useState<SubTab>('invoices')

  const customer = useCustomer(customerId)
  const invoices = useCustomerInvoices(customerId)
  const payments = useCustomerPayments(customerId)
  const statement = useCustomerStatement(customerId)

  const invoiceColumns: ColumnDef<SalesInvoiceListItem, any>[] = [
    {
      accessorKey: 'invoice_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="رقم الفاتورة" />,
      meta: { exportLabel: 'رقم الفاتورة' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.invoice_number}</span>
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
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${customerId}/invoices/${row.original.id}`)}>
          عرض
        </Button>
      )
    }
  ]

  const paymentColumns: ColumnDef<CustomerPayment, any>[] = [
    {
      accessorKey: 'payment_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.payment_date)}</span>
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="المبلغ" />,
      meta: { exportLabel: 'المبلغ' },
      cell: ({ row }) => <span className="tabular-nums font-semibold text-success">{formatCurrency(row.original.amount)}</span>
    },
    {
      accessorKey: 'payment_method',
      header: 'طريقة الدفع',
      meta: { exportLabel: 'طريقة الدفع' },
      cell: ({ row }) => row.original.payment_method ?? '—'
    },
    {
      accessorKey: 'notes',
      header: 'ملاحظات',
      meta: { exportLabel: 'ملاحظات' },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? '—'}</span>
    }
  ]

  const statementColumns: ColumnDef<CustomerStatementEntry, any>[] = [
    {
      accessorKey: 'entry_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="التاريخ" />,
      meta: { exportLabel: 'التاريخ' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.entry_date)}</span>
    },
    {
      accessorKey: 'entry_type',
      header: 'النوع',
      meta: { exportLabel: 'النوع' },
      cell: ({ row }) =>
        row.original.entry_type === 'invoice' ? (
          <Badge variant="destructive">فاتورة</Badge>
        ) : row.original.entry_type === 'adjustment' ? (
          <Badge variant="warning">تسوية</Badge>
        ) : (
          <Badge variant="success">دفعة</Badge>
        )
    },
    {
      accessorKey: 'reference',
      header: 'المرجع',
      meta: { exportLabel: 'المرجع' },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.reference ?? '—'}</span>
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
      accessorKey: 'balance',
      header: 'الرصيد',
      meta: { exportLabel: 'الرصيد' },
      cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.balance)}</span>
    }
  ]

  if (customer.isLoading) return <LoadingState rows={6} />
  if (customer.error || !customer.data) {
    return <ErrorState message={customer.error?.message ?? 'العميل غير موجود'} onRetry={() => customer.refetch()} />
  }

  const data = customer.data

  return (
    <div className="flex flex-1 flex-col">
      <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('/customers')}>
        <ArrowRight className="size-4" />
        {t('customers.title')}
      </Button>

      <PageHeader
        title={data.full_name}
        subtitle={data.phone ?? undefined}
        actions={
          <>
            <AdjustCustomerBalanceDialog customerId={customerId} />
            <RecordCustomerPaymentDialog customerId={customerId} />
            <CreateSalesInvoiceSheet customerId={customerId} previousBalance={data.current_balance} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Wallet} label={t('customers.currentBalance')} value={formatCurrency(data.current_balance)} />
        <StatCard icon={FileText} label="إجمالي الفواتير" value={formatCurrency(data.total_invoice_amount)} />
        <StatCard icon={Wallet} label="إجمالي المدفوعات" value={formatCurrency(data.total_payment_amount)} />
        <StatCard icon={Calendar} label="آخر فاتورة" value={formatDate(data.last_invoice_date)} />
        <StatCard icon={Calendar} label="آخر دفعة" value={formatDate(data.last_payment_date)} />
      </div>

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'invoices' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('invoices')}>
          {t('customers.invoicesTab')}
        </Button>
        <Button variant={tab === 'payments' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('payments')}>
          {t('customers.paymentsTab')}
        </Button>
        <Button variant={tab === 'statement' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('statement')}>
          {t('customers.statementTab')}
        </Button>
      </div>

      {tab === 'invoices' && (
        <DataTable
          columns={invoiceColumns}
          data={invoices.data ?? []}
          isLoading={invoices.isLoading}
          exportFileName={`customer-${customerId}-invoices`}
          emptyTitle="لا توجد فواتير بعد"
        />
      )}
      {tab === 'payments' && (
        <DataTable
          columns={paymentColumns}
          data={payments.data ?? []}
          isLoading={payments.isLoading}
          exportFileName={`customer-${customerId}-payments`}
          emptyTitle="لا توجد دفعات مسجلة بعد"
        />
      )}
      {tab === 'statement' && (
        <DataTable
          columns={statementColumns}
          data={statement.data ?? []}
          isLoading={statement.isLoading}
          exportFileName={`customer-${customerId}-statement`}
          emptyTitle="لا توجد حركات في كشف الحساب بعد"
          pageSize={15}
        />
      )}
    </div>
  )
}
