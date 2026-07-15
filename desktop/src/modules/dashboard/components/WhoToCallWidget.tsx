import { Link } from 'react-router-dom'
import { PhoneCall } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useSupplierAging } from '../hooks/useDashboardData'

/** Suppliers whose oldest bucket (90+ days) still carries a balance get flagged first. */
function severityBadge(agedBalance: number) {
  if (agedBalance <= 0) return null
  return (
    <Badge variant="destructive" className="shrink-0">
      متأخر +90 يوم
    </Badge>
  )
}

export function WhoToCallWidget() {
  const { t } = useI18n()
  const { data, isLoading, error } = useSupplierAging()

  const topDebtors = [...(data ?? [])]
    .filter((s) => s.current_balance > 0)
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.whoToCall')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={3} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : topDebtors.length === 0 ? (
          <EmptyState icon={PhoneCall} title="لا توجد ديون مستحقة" />
        ) : (
          <ul className="divide-y divide-border">
            {topDebtors.map((s) => (
              <li key={s.id}>
                <Link
                  to="/suppliers"
                  className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  {severityBadge(s._90_plus)}
                  <span className="tabular-nums shrink-0 font-semibold text-foreground">
                    {formatCurrency(s.current_balance)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
