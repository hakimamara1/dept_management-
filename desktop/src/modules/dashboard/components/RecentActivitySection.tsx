import type { LucideIcon } from 'lucide-react'
import { Banknote, FileCheck, FileInput, History, TrendingUp, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatCurrency } from '@shared/lib/format'
import type { ActivityType } from '@shared/types/api'
import { useRecentActivity } from '../hooks/useDashboardAnalytics'

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  invoice_imported: FileInput,
  invoice_approved: FileCheck,
  payment_recorded: Banknote,
  supplier_created: UserPlus,
  price_changed: TrendingUp
}

function timeAgo(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.round(hours / 24)
  return `منذ ${days} يوم`
}

export function RecentActivitySection() {
  const { data, isLoading, error } = useRecentActivity(20)

  return (
    <Card>
      <CardHeader>
        <CardTitle>النشاط الأخير</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={History} title="لا يوجد نشاط حديث" />
        ) : (
          <ul className="flex flex-col gap-4">
            {data.map((activity, i) => {
              const Icon = ACTIVITY_ICON[activity.type]
              return (
                <li key={`${activity.type}-${activity.ts}-${i}`} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{activity.label}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(activity.ts)}</span>
                    </div>
                    {activity.detail != null && (
                      <span className="tabular-nums text-sm font-medium text-foreground">
                        {formatCurrency(activity.detail)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
