import { Card, CardContent } from '@shared/components/ui/card'
import { cn } from '@shared/lib/utils'
import type { DebtVerdict } from '../lib/debtVerdict'

const TONE = {
  down: 'border-success/40 bg-success/5',
  up: 'border-destructive/40 bg-destructive/5',
  stable: 'border-warning/40 bg-warning/5'
} as const

export function DebtVerdictBanner({ verdict }: { verdict: DebtVerdict }) {
  return (
    <Card className={cn('mb-6', TONE[verdict.status])}>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="text-lg font-semibold text-foreground">{verdict.title}</div>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {verdict.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
