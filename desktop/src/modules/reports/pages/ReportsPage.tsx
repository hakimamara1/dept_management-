import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, TrendingDown, TrendingUp, Wallet, XCircle } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { StatCard } from '@shared/components/StatCard'
import { PageHeader } from '@shared/components/PageHeader'
import { LoadingState } from '@shared/components/LoadingState'
import { formatCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import type { AccountCode, TrialBalanceRow } from '@shared/types/api'
import { useBalanceSheet, useProfitLoss, useTrialBalance, useVerifyBalance } from '../hooks/useReports'

type SubTab = 'trialBalance' | 'balanceSheet' | 'profitLoss'

const ACCOUNT_LABELS: Record<AccountCode, string> = {
  inventory: 'المخزون',
  accounts_payable: 'ذمم الموردين',
  purchases: 'المشتريات',
  cash: 'الصندوق',
  bank: 'البنك',
  sales: 'المبيعات',
  cogs: 'تكلفة البضاعة المباعة',
  discount_received: 'خصومات مكتسبة',
  tax_payable: 'ضريبة مستحقة'
}

const trialBalanceColumns: ColumnDef<TrialBalanceRow, any>[] = [
  {
    accessorKey: 'account_code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="الحساب" />,
    meta: { exportLabel: 'الحساب' },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {ACCOUNT_LABELS[row.original.account_code as AccountCode] ?? row.original.account_code}
      </span>
    )
  },
  {
    accessorKey: 'total_debit',
    header: ({ column }) => <DataTableColumnHeader column={column} title="مدين" />,
    meta: { exportLabel: 'مدين' },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total_debit)}</span>
  },
  {
    accessorKey: 'total_credit',
    header: ({ column }) => <DataTableColumnHeader column={column} title="دائن" />,
    meta: { exportLabel: 'دائن' },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total_credit)}</span>
  },
  {
    accessorKey: 'balance',
    header: ({ column }) => <DataTableColumnHeader column={column} title="الرصيد" />,
    meta: { exportLabel: 'الرصيد' },
    cell: ({ row }) => {
      const balance = Number(row.original.balance)
      return (
        <span className={cn('tabular-nums font-semibold', balance >= 0 ? 'text-foreground' : 'text-destructive')}>
          {formatCurrency(balance)}
        </span>
      )
    }
  }
]

function BalanceVerificationBadge() {
  const { data, isLoading } = useVerifyBalance()
  if (isLoading || !data) return null

  return (
    <Badge variant={data.balanced ? 'success' : 'destructive'} className="gap-1.5 px-3 py-1.5 text-xs">
      {data.balanced ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {data.balanced ? 'الدفاتر متوازنة' : `فرق غير متوازن: ${formatCurrency(data.difference)}`}
    </Badge>
  )
}

export function ReportsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<SubTab>('trialBalance')

  const trialBalance = useTrialBalance()
  const balanceSheet = useBalanceSheet()
  const profitLoss = useProfitLoss()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('nav.reports')} subtitle="الميزان، الميزانية العمومية، والأرباح والخسائر" actions={<BalanceVerificationBadge />} />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'trialBalance' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('trialBalance')}>
          ميزان المراجعة
        </Button>
        <Button variant={tab === 'balanceSheet' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('balanceSheet')}>
          الميزانية العمومية
        </Button>
        <Button variant={tab === 'profitLoss' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('profitLoss')}>
          الأرباح والخسائر
        </Button>
      </div>

      {tab === 'trialBalance' && (
        <DataTable
          columns={trialBalanceColumns}
          data={trialBalance.data ?? []}
          isLoading={trialBalance.isLoading}
          exportFileName="trial-balance"
          emptyTitle="لا توجد قيود محاسبية بعد"
        />
      )}

      {tab === 'balanceSheet' &&
        (balanceSheet.isLoading ? (
          <LoadingState rows={3} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Wallet} label="الأصول" value={formatCurrency(balanceSheet.data?.assets ?? 0)} />
            <StatCard icon={TrendingDown} label="الخصوم" value={formatCurrency(balanceSheet.data?.liabilities ?? 0)} />
            <StatCard icon={TrendingUp} label="صافي حقوق الملكية" value={formatCurrency(balanceSheet.data?.netWorth ?? 0)} />
          </div>
        ))}

      {tab === 'profitLoss' &&
        (profitLoss.isLoading ? (
          <LoadingState rows={3} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="الإيرادات" value={formatCurrency(profitLoss.data?.revenue ?? 0)} />
            <StatCard icon={TrendingDown} label="تكلفة البضاعة المباعة" value={formatCurrency(profitLoss.data?.cogs ?? 0)} />
            <StatCard icon={Wallet} label="إجمالي المشتريات" value={formatCurrency(profitLoss.data?.netPurchases ?? 0)} />
            <StatCard icon={TrendingUp} label="إجمالي الربح" value={formatCurrency(profitLoss.data?.grossProfit ?? 0)} />
          </div>
        ))}
    </div>
  )
}
