import { PageHeader } from '@shared/components/PageHeader'
import { useI18n } from '@shared/lib/i18n'
import { useDateRange } from '../hooks/useDateRange'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { QuickActionsBar } from '../components/QuickActionsBar'
import { AlertsSection } from '../components/AlertsSection'
import { KpiGrid } from '../components/KpiGrid'
import { DebtAnalyticsSection } from '../components/DebtAnalyticsSection'
import { PurchaseAnalyticsSection } from '../components/PurchaseAnalyticsSection'
import { PriceChangesSection } from '../components/PriceChangesSection'
import { InsightsSection } from '../components/InsightsSection'
import { OutstandingDebtsSection } from '../components/OutstandingDebtsSection'
import { RecentActivitySection } from '../components/RecentActivitySection'

export function DashboardPage() {
  const { t } = useI18n()
  const { range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, isCustomReady } = useDateRange()
  const from = range === 'custom' ? customFrom : undefined
  const to = range === 'custom' ? customTo : undefined
  const ready = range !== 'custom' || isCustomReady

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <DateRangeFilter
            range={range}
            onRangeChange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        }
      />

      <div className="flex flex-col gap-6">
        <QuickActionsBar />

        {ready && (
          <>
            <AlertsSection range={range} from={from} to={to} />
            <KpiGrid range={range} from={from} to={to} />
            <DebtAnalyticsSection range={range} from={from} to={to} />
            <PurchaseAnalyticsSection range={range} from={from} to={to} />
            <PriceChangesSection range={range} from={from} to={to} />
            <InsightsSection range={range} from={from} to={to} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <OutstandingDebtsSection />
              <RecentActivitySection />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
