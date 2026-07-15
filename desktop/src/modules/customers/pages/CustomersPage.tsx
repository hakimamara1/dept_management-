import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Search, TrendingUp, Users, Wallet } from 'lucide-react'
import { Input } from '@shared/components/ui/input'
import { Button } from '@shared/components/ui/button'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { StatCard } from '@shared/components/StatCard'
import { LoadingState } from '@shared/components/LoadingState'
import { formatCurrency, formatDate } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import type { Customer } from '@shared/types/api'
import { useCustomers } from '../hooks/useCustomers'
import { useCustomerReports } from '../hooks/useCustomerReports'
import { CreateCustomerDialog } from '../components/CreateCustomerDialog'

type SubTab = 'all' | 'reports'

export function CustomersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<SubTab>('all')
  const [query, setQuery] = useState('')

  const customers = useCustomers(query)
  const reports = useCustomerReports()

  const columns: ColumnDef<Customer, any>[] = [
    {
      accessorKey: 'full_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم العميل" />,
      meta: { exportLabel: 'اسم العميل' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.full_name}</span>
    },
    {
      accessorKey: 'phone',
      header: 'الهاتف',
      meta: { exportLabel: 'الهاتف' },
      cell: ({ row }) => row.original.phone ?? '—'
    },
    {
      accessorKey: 'current_balance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الرصيد الحالي" />,
      meta: { exportLabel: 'الرصيد الحالي' },
      cell: ({ row }) => {
        const balance = Number(row.original.current_balance)
        return (
          <span className={cn('tabular-nums font-semibold', balance > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {formatCurrency(balance)}
          </span>
        )
      }
    },
    {
      accessorKey: 'total_invoices',
      header: 'عدد الفواتير',
      meta: { exportLabel: 'عدد الفواتير' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.total_invoices}</span>
    },
    {
      accessorKey: 'total_payments',
      header: 'عدد الدفعات',
      meta: { exportLabel: 'عدد الدفعات' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.total_payments}</span>
    },
    {
      accessorKey: 'last_invoice_date',
      header: 'آخر فاتورة',
      meta: { exportLabel: 'آخر فاتورة' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.last_invoice_date)}</span>
    },
    {
      accessorKey: 'last_payment_date',
      header: 'آخر دفعة',
      meta: { exportLabel: 'آخر دفعة' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.last_payment_date)}</span>
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${row.original.id}`)}>
          عرض
        </Button>
      )
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('customers.title')} subtitle={t('customers.subtitle')} actions={<CreateCustomerDialog />} />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('all')}>
          كل العملاء
        </Button>
        <Button variant={tab === 'reports' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('reports')}>
          {t('customers.reportsTab')}
        </Button>
      </div>

      {tab === 'all' ? (
        <DataTable
          columns={columns}
          data={customers.data ?? []}
          isLoading={customers.isLoading}
          exportFileName="customers"
          emptyTitle="لا يوجد عملاء بعد"
          toolbar={
            <div className="relative max-w-sm">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('customers.searchPlaceholder')}
                className="ps-9"
              />
            </div>
          }
        />
      ) : reports.isLoading || !reports.data ? (
        <LoadingState rows={5} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="إجمالي العملاء" value={String(reports.data.total_customers)} />
            <StatCard icon={Wallet} label="إجمالي ديون العملاء" value={formatCurrency(reports.data.total_customer_debt)} />
            <StatCard icon={TrendingUp} label="إجمالي قيمة الفواتير" value={formatCurrency(reports.data.total_invoice_value)} />
            <StatCard icon={Wallet} label="متوسط قيمة الفاتورة" value={formatCurrency(reports.data.average_invoice_value)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">أكبر المدينين</div>
              <ul className="divide-y divide-border">
                {reports.data.largestDebtors.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <button className="text-foreground hover:text-primary" onClick={() => navigate(`/customers/${d.id}`)}>
                      {d.full_name}
                    </button>
                    <span className="tabular-nums font-medium">{formatCurrency(d.balance)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">الأكثر نشاطاً</div>
              <ul className="divide-y divide-border">
                {reports.data.mostActive.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <button className="text-foreground hover:text-primary" onClick={() => navigate(`/customers/${d.id}`)}>
                      {d.full_name}
                    </button>
                    <span className="tabular-nums text-muted-foreground">{d.activity_count} عملية</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
