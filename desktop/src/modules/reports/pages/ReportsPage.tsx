import { useState } from 'react'
import { Button } from '@shared/components/ui/button'
import { PageHeader } from '@shared/components/PageHeader'
import { useI18n } from '@shared/lib/i18n'
import { DebtAnalysisTab } from '../components/DebtAnalysisTab'
import { AccountingReports } from '../components/AccountingReports'

type TopTab = 'debt' | 'accounting'

export function ReportsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TopTab>('debt')

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={t('nav.reports')} subtitle="هل وضعك المالي يتحسن أم يتدهور؟ تحليل الديون وأسباب تغيّرها" />

      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <Button variant={tab === 'debt' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('debt')}>
          تحليل الديون
        </Button>
        <Button variant={tab === 'accounting' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('accounting')}>
          المحاسبة (متقدم)
        </Button>
      </div>

      {tab === 'debt' ? <DebtAnalysisTab /> : <AccountingReports />}
    </div>
  )
}
