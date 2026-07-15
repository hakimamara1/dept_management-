import { AlertTriangle } from 'lucide-react'
import { Button } from '@shared/components/ui/button'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'حدث خطأ', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 py-12 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}
