import { useEffect, useState } from 'react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { useUpdateProductPrice } from '../hooks/useUpdateProductPrice'
import type { Product } from '@shared/types/api'

interface EditSalePriceDialogProps {
  product: Product | null
  onOpenChange: (open: boolean) => void
}

/**
 * Narrow, single-field dialog — this only ever sets default_sale_price.
 * There's no general "edit product" feature yet; this exists specifically
 * so an already-existing product can get a selling price set retroactively
 * for the sales-invoice ProductPicker to suggest.
 */
export function EditSalePriceDialog({ product, onOpenChange }: EditSalePriceDialogProps) {
  const [price, setPrice] = useState('')
  const updatePrice = useUpdateProductPrice()

  useEffect(() => {
    setPrice(product?.default_sale_price != null ? String(product.default_sale_price) : '')
  }, [product])

  function handleSave() {
    if (!product) return
    const parsed = Number(price)
    if (price === '' || Number.isNaN(parsed) || parsed < 0) return

    updatePrice.mutate(
      { productId: product.id, defaultSalePrice: parsed },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={product != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>سعر البيع المقترح</DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="sale-price">السعر (دج)</Label>
          <Input
            id="sale-price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" onClick={handleSave} disabled={updatePrice.isPending}>
            {updatePrice.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
