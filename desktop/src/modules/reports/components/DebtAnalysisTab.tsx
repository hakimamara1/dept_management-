import { useMemo, useState } from 'react'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { useDateRange } from '@shared/hooks/useDateRange'
import type { DebtScope } from '@shared/types/api'
import { useDebtAnalysis } from '../hooks/useReports'
import { buildVerdict } from '../lib/debtVerdict'
import { DebtFilters } from './DebtFilters'
import { DebtVerdictBanner } from './DebtVerdictBanner'
import { DebtKpiGrid } from './DebtKpiGrid'
import { DebtTrendChart } from './DebtTrendChart'
import { FlowsChart } from './FlowsChart'
import { DebtAnalysisSection } from './DebtAnalysisSection'
import { DebtTransactionsTable } from './DebtTransactionsTable'

/** Filters → verdict → KPIs → trend → flows → analysis → transactions. */
export function DebtAnalysisTab() {
  const { range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, isCustomReady } = useDateRange()
  const [scope, setScope] = useState<DebtScope>('suppliers')
  const [entity, setEntity] = useState<{ id: number; name: string } | null>(null)

  const filters = {
    scope,
    range,
    from: range === 'custom' ? customFrom : undefined,
    to: range === 'custom' ? customTo : undefined,
    entityId: entity?.id ?? null
  }
  const { data, isLoading, error, refetch } = useDebtAnalysis(filters, isCustomReady)
  const verdict = useMemo(() => (data ? buildVerdict(data) : null), [data])

  return (
    <div>
      <DebtFilters
        scope={scope}
        onScopeChange={(s) => {
          setScope(s)
          setEntity(null) // a supplier id means nothing in the customers scope
        }}
        range={range}
        onRangeChange={setRange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        entity={entity}
        onEntityChange={setEntity}
      />

      {!isCustomReady ? (
        <p className="text-sm text-muted-foreground">اختر تاريخ البداية والنهاية لعرض التحليل.</p>
      ) : isLoading ? (
        <LoadingState rows={6} />
      ) : error || !data || !verdict ? (
        <ErrorState message={error?.message ?? 'تعذّر تحميل التحليل'} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <DebtVerdictBanner verdict={verdict} />
            <DebtKpiGrid data={data} />
          </div>
          <DebtTrendChart data={data} />
          <FlowsChart data={data} />
          <DebtAnalysisSection data={data} verdict={verdict} />
          <DebtTransactionsTable data={data} />
        </div>
      )}
    </div>
  )
}
