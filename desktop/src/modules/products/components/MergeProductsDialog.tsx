import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/components/ui/dialog'
import { cn } from '@shared/lib/utils'
import type { Product } from '@shared/types/api'
import { useMergeProducts } from '../hooks/useMergeProducts'

interface MergeProductsDialogProps {
  products: [Product, Product] | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged: () => void
}

/**
 * Merges two accidentally-duplicated products into one. The user picks
 * which one survives; the other's full purchase/stock history moves onto
 * the survivor and it is then deleted — see productService.mergeProducts.
 */
export function MergeProductsDialog({ products, open, onOpenChange, onMerged }: MergeProductsDialogProps) {
  const [keepId, setKeepId] = useState<number | null>(null)
  const mergeProducts = useMergeProducts()

  useEffect(() => {
    if (products) setKeepId(products[0].id)
  }, [products])

  if (!products) return null
  const [a, b] = products
  const mergeAway = keepId === a.id ? b : a

  function handleConfirm() {
    if (keepId == null) return
    mergeProducts.mutate(
      { keepId, mergeId: mergeAway.id },
      { onSuccess: () => { onOpenChange(false); onMerged() } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>دمج منتجين مكررين</DialogTitle>
          <DialogDescription>اختر المنتج الذي سيبقى — سيتم نقل كل تاريخ الشراء والمخزون إليه وحذف الآخر نهائياً.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {[a, b].map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setKeepId(product.id)}
              className={cn(
                'rounded-lg border p-3 text-start transition-colors',
                keepId === product.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              )}
            >
              <div className="font-semibold">{product.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {product.category ?? '—'} · {product.unit ?? '—'}
              </div>
              <div className="mt-2 text-xs">
                {keepId === product.id ? (
                  <span className="font-medium text-primary">سيبقى هذا المنتج</span>
                ) : (
                  <span className="text-destructive">سيُحذف هذا المنتج</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            سيتم نقل كل حركات المخزون وفواتير الشراء والأسماء البديلة الخاصة بـ «{mergeAway.name}» إلى «
            {keepId === a.id ? a.name : b.name}»، ثم حذف «{mergeAway.name}» نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={mergeProducts.isPending}>
            {mergeProducts.isPending ? 'جاري الدمج...' : 'تأكيد الدمج'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
