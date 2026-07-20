import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { useDashboardKpis, useDebtBySupplier, usePriceChanges } from '../hooks/useDashboardAnalytics'
import { generateInsights } from '../lib/insights'

export function InsightsSection({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { data: kpis } = useDashboardKpis(range, from, to)
  const { data: debtBySupplier } = useDebtBySupplier(8)
  const { data: priceChanges } = usePriceChanges(range, from, to)

  const insights = generateInsights(kpis, debtBySupplier, priceChanges)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ملاحظات ذكية</CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <EmptyState icon={Lightbulb} title="لا توجد ملاحظات لهذه الفترة" />
        ) : (
          <ul className="flex flex-col gap-3">
            {insights.map((insight) => (
              <li key={insight.id} className="flex items-start gap-2.5 text-sm text-foreground">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
