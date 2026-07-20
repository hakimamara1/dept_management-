import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/lib/utils'
import { useDashboardKpis, useDebtBySupplier, useOutstandingDebts, usePriceChanges } from '../hooks/useDashboardAnalytics'
import { generateAlerts, type Alert } from '../lib/insights'

const SEVERITY_LABEL: Record<Alert['severity'], string> = {
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض'
}

const SEVERITY_VARIANT: Record<Alert['severity'], 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary'
}

/** Only rendered by the caller when `alerts.length > 0` — see DashboardPage. */
export function AlertsSection({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { data: kpis } = useDashboardKpis(range, from, to)
  const { data: debtBySupplier } = useDebtBySupplier(8)
  const { data: priceChanges } = usePriceChanges(range, from, to)
  const { data: outstandingDebts } = useOutstandingDebts(10)

  const alerts = generateAlerts(kpis, debtBySupplier, priceChanges, outstandingDebts)
  if (alerts.length === 0) return null

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" />
          تنبيهات
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={cn(
                'flex items-start justify-between gap-3 rounded-md border border-border p-3',
                alert.severity === 'high' && 'bg-destructive/5'
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{alert.title}</span>
                <span className="text-xs text-muted-foreground">{alert.description}</span>
              </div>
              <Badge variant={SEVERITY_VARIANT[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
