import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card, CardContent } from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/components/ui/tooltip'
import { cn } from '@shared/lib/utils'

interface StatCardDelta {
  label: string
  direction: 'up' | 'down' | 'flat'
  /** Whether an "up" movement is good news (e.g. stock value) or bad (e.g. debt). */
  upIsGood: boolean
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  delta?: StatCardDelta
  loading?: boolean
  tooltip?: string
}

/**
 * The one reusable "number that matters" primitive — every module's
 * dashboard-style summary reuses this instead of hand-rolling stat blocks.
 */
export function StatCard({ icon: Icon, label, value, delta, loading, tooltip }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="size-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const deltaIsPositive = delta && (delta.direction === 'up' ? delta.upIsGood : !delta.upIsGood)

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-fit cursor-default text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                  {label}
                </div>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="text-xs text-muted-foreground">{label}</div>
          )}
          <div className="flex items-baseline gap-2">
            <div className="tabular-nums text-lg font-semibold text-foreground">{value}</div>
            {delta && delta.direction !== 'flat' && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  deltaIsPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {delta.direction === 'up' ? (
                  <ArrowUp className="size-3" />
                ) : (
                  <ArrowDown className="size-3" />
                )}
                {delta.label}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
