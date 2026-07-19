import { Badge } from '@shared/components/ui/badge'
import type { ExpirationBatchStatus } from '@shared/types/api'

const STATUS_META: Record<ExpirationBatchStatus, { label: string; variant: 'secondary' | 'warning' | 'destructive' | 'success' | 'outline' }> = {
  ACTIVE: { label: 'نشطة', variant: 'secondary' },
  NEAR_EXPIRY: { label: 'قريبة الانتهاء', variant: 'warning' },
  EXPIRED: { label: 'منتهية الصلاحية', variant: 'destructive' },
  DISCARDED: { label: 'تم إتلافها', variant: 'outline' },
  SOLD: { label: 'مباعة', variant: 'success' }
}

export function BatchStatusBadge({ status }: { status: ExpirationBatchStatus }) {
  const meta = STATUS_META[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
