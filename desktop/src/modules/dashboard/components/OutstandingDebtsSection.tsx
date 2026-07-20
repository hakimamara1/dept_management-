import { CircleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency } from '@shared/lib/format'
import type { OutstandingDebtEntry } from '@shared/types/api'
import { useOutstandingDebts } from '../hooks/useDashboardAnalytics'

const PRIORITY_VARIANT: Record<OutstandingDebtEntry['priority'], 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary'
}

const PRIORITY_LABEL: Record<OutstandingDebtEntry['priority'], string> = {
  high: 'عاجل',
  medium: 'متوسط',
  low: 'منخفض'
}

export function OutstandingDebtsSection() {
  const { data, isLoading, error } = useOutstandingDebts(10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>أقدم الديون المستحقة</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={CircleAlert} title="لا توجد ديون مستحقة حالياً" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {data.map((entry) => (
              <div key={entry.supplier} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{entry.supplier}</span>
                  <span className="text-xs text-muted-foreground">أقدم رصيد: {entry.oldestBucket}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm font-semibold text-foreground">
                    {formatCurrency(entry.amount)}
                  </span>
                  <Badge variant={PRIORITY_VARIANT[entry.priority]}>{PRIORITY_LABEL[entry.priority]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
