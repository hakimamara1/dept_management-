import { Skeleton } from '@shared/components/ui/skeleton'

interface LoadingStateProps {
  rows?: number
}

export function LoadingState({ rows = 4 }: LoadingStateProps) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
