import { Link } from 'react-router-dom'
import { CheckCircle2, PackageX, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { EmptyState } from '@shared/components/EmptyState'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { useI18n } from '@shared/lib/i18n'
import { useLowStock, usePendingInvoices } from '../hooks/useDashboardData'

type AttentionItem = {
  key: string
  icon: typeof PackageX
  label: string
  detail: string
  to: string
}

/**
 * Merges two different data sources (low stock, pending review invoices)
 * into one ranked "do this next" list — the dashboard's actual job per the
 * brief: decision support, not a second copy of the raw tables.
 */
export function AttentionPanel() {
  const { t } = useI18n()
  const lowStock = useLowStock(10)
  const pendingInvoices = usePendingInvoices()

  const isLoading = lowStock.isLoading || pendingInvoices.isLoading
  const error = lowStock.error ?? pendingInvoices.error

  const items: AttentionItem[] = [
    ...(pendingInvoices.data ?? []).map((inv) => ({
      key: `invoice-${inv.id}`,
      icon: Receipt,
      label: `فاتورة #${inv.invoice_number} — ${inv.supplier_name}`,
      detail: `${inv.pending_items} من ${inv.total_items} أصناف تحتاج مطابقة`,
      to: '/invoices'
    })),
    ...(lowStock.data ?? []).map((p) => ({
      key: `stock-${p.id}`,
      icon: PackageX,
      label: p.name,
      detail:
        p.current_stock === 0
          ? 'نفذ من المخزون'
          : `المخزون منخفض: ${p.current_stock.toLocaleString('ar-DZ')} ${p.unit ?? ''}`,
      to: '/products'
    }))
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('dashboard.needsAttention')}</CardTitle>
        {items.length > 0 && <Badge variant="warning">{items.length}</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={3} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="كل شيء تحت السيطرة" description="لا توجد فواتير معلقة أو نواقص مخزون حالياً" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
