import { Boxes, Clock, Package, Wallet } from 'lucide-react'
import { StatCard } from '@shared/components/StatCard'
import { formatCompactCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useDashboardStats } from '../hooks/useDashboardData'

export function StatCardGrid() {
  const { t } = useI18n()
  const { data, isLoading } = useDashboardStats()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Boxes}
        label={t('dashboard.stockValue')}
        value={formatCompactCurrency(data?.total_stock_value)}
        loading={isLoading}
      />
      <StatCard
        icon={Wallet}
        label={t('dashboard.totalDebt')}
        value={formatCompactCurrency(data?.total_debt)}
        loading={isLoading}
      />
      <StatCard
        icon={Clock}
        label={t('dashboard.pendingInvoices')}
        value={String(data?.pending_invoices ?? 0)}
        loading={isLoading}
      />
      <StatCard
        icon={Package}
        label={t('dashboard.totalProducts')}
        value={String(data?.total_products ?? 0)}
        loading={isLoading}
      />
    </div>
  )
}
