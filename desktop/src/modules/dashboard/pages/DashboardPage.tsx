import { PageHeader } from '@shared/components/PageHeader'
import { useI18n } from '@shared/lib/i18n'
import { StatCardGrid } from '../components/StatCardGrid'
import { AttentionPanel } from '../components/AttentionPanel'
import { WhoToCallWidget } from '../components/WhoToCallWidget'
import { PurchaseTrendChart } from '../components/PurchaseTrendChart'

export function DashboardPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <div className="flex flex-col gap-6">
        <StatCardGrid />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PurchaseTrendChart />
          </div>
          <WhoToCallWidget />
        </div>

        <AttentionPanel />
      </div>
    </div>
  )
}
