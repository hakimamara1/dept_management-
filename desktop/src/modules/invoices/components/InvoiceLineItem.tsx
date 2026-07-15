import { useState } from 'react'
import { Check, PackagePlus, Sparkles } from 'lucide-react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { ProductPicker, type PickedProduct } from '@shared/components/ProductPicker'
import { formatCurrency } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { InvoiceDecision, InvoiceReviewItem } from '@shared/types/api'

const UNIT_OPTIONS = [
  { value: 'piece', label: 'قطعة' },
  { value: 'kg', label: 'كيلو' },
  { value: 'box', label: 'علبة' },
  { value: 'liter', label: 'لتر' },
  { value: 'g', label: 'غرام' }
]

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  Matched: { label: 'مطابق', variant: 'success' },
  UserSelected: { label: 'مختار يدوياً', variant: 'success' },
  Pending: { label: 'بحاجة مطابقة', variant: 'warning' },
  NewProduct: { label: 'منتج جديد محتمل', variant: 'warning' }
}

interface InvoiceLineItemProps {
  item: InvoiceReviewItem
  decision: InvoiceDecision | null
  onDecide: (decision: InvoiceDecision | null) => void
}

const isResolved = (item: InvoiceReviewItem) => item.match_status === 'Matched' || item.match_status === 'UserSelected'

export function InvoiceLineItem({ item, decision, onDecide }: InvoiceLineItemProps) {
  const [mode, setMode] = useState<'idle' | 'search' | 'new'>('idle')
  const [newUnit, setNewUnit] = useState('piece')

  const resolved = isResolved(item)
  const badge = STATUS_BADGE[item.match_status] ?? { label: item.match_status, variant: 'secondary' as const }

  const decisionLabel = decision
    ? decision.action === 'create_new'
      ? `سيُنشأ كمنتج جديد (${UNIT_OPTIONS.find((u) => u.value === decision.unit)?.label ?? decision.unit})`
      : null
    : null

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{item.ocr_product_name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            الكمية {Number(item.quantity).toLocaleString('ar-DZ')} · سعر الوحدة {formatCurrency(item.unit_price)} · الإجمالي{' '}
            {formatCurrency(item.total_price)}
          </div>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {resolved ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-success">
          <Check className="size-4" />
          {item.matched_product_name ?? 'تم المطابقة'}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {decision && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Check className="size-4" />
              {decisionLabel ?? 'تم اختيار منتج — سيُحفظ عند الاعتماد'}
            </div>
          )}

          {item.suggested_product_name && mode === 'idle' && (
            <div className="flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2 text-sm">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span className="flex-1">
                الاقتراح: <strong>{item.suggested_product_name}</strong>
                {item.match_confidence != null && (
                  <span className="text-muted-foreground"> ({Math.round(item.match_confidence * 100)}%)</span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant={decision?.productId === item.suggested_product_id ? 'default' : 'outline'}
                onClick={() =>
                  onDecide({ itemId: item.id, action: 'select_existing', productId: item.suggested_product_id! })
                }
              >
                تأكيد
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {mode !== 'search' ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode('search')}>
                اختيار منتج آخر
              </Button>
            ) : (
              <div className="w-64">
                <ProductPicker
                  value={null}
                  onChange={(product: PickedProduct | null) => {
                    if (product) {
                      onDecide({ itemId: item.id, action: 'select_existing', productId: product.id })
                      setMode('idle')
                    }
                  }}
                />
              </div>
            )}

            {mode !== 'new' ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMode('new')
                  onDecide({ itemId: item.id, action: 'create_new', unit: newUnit })
                }}
              >
                <PackagePlus className="size-3.5" />
                منتج جديد
              </Button>
            ) : (
              <div className={cn('flex items-center gap-2')}>
                <Select
                  value={newUnit}
                  onValueChange={(unit) => {
                    setNewUnit(unit)
                    onDecide({ itemId: item.id, action: 'create_new', unit })
                  }}
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setMode('idle'); onDecide(null) }}>
                  إلغاء
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
