import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { ProductPicker, type PickedProduct } from '@shared/components/ProductPicker'
import { formatCurrency } from '@shared/lib/format'
import type { PurchaseOrderItem } from '@shared/types/api'
import { useDeletePurchaseOrderItem, useUpdatePurchaseOrderItem } from '../hooks/usePurchaseOrderMutations'

interface PurchaseOrderItemRowProps {
  orderId: number
  item: PurchaseOrderItem
  readOnly: boolean
  canDelete: boolean
}

/** One line of the Draft-editable items table, or a plain read-only row otherwise. */
export function PurchaseOrderItemRow({ orderId, item, readOnly, canDelete }: PurchaseOrderItemRowProps) {
  const [quantity, setQuantity] = useState(item.quantity)
  const [expectedUnitPrice, setExpectedUnitPrice] = useState(item.expected_unit_price ?? undefined)

  const updateItem = useUpdatePurchaseOrderItem(orderId)
  const deleteItem = useDeletePurchaseOrderItem(orderId)
  const total = Number(quantity || 0) * Number(expectedUnitPrice || 0)

  function saveFields() {
    if (quantity === item.quantity && (expectedUnitPrice ?? null) === item.expected_unit_price) return
    updateItem.mutate({ itemId: item.id, data: { quantity, expectedUnitPrice } })
  }

  function handleProductChange(product: PickedProduct | null) {
    if (product) {
      updateItem.mutate({ itemId: item.id, data: { productId: product.id } })
    }
  }

  if (readOnly) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-2.5 align-middle">{item.product_name}</td>
        <td className="px-3 py-2.5 align-middle tabular-nums">
          {Number(item.quantity).toLocaleString('ar-DZ')} {item.unit ?? ''}
        </td>
        <td className="px-3 py-2.5 align-middle tabular-nums">{formatCurrency(item.expected_unit_price)}</td>
        <td className="px-3 py-2.5 align-middle tabular-nums font-semibold">
          {formatCurrency(Number(item.quantity) * Number(item.expected_unit_price ?? 0))}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="min-w-48 px-1.5 py-2">
        <ProductPicker value={{ id: item.product_id, name: item.product_name, unit: item.unit }} onChange={handleProductChange} />
      </td>
      <td className="w-28 px-1.5 py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.valueAsNumber)}
          onBlur={saveFields}
          className="h-8 text-xs"
        />
      </td>
      <td className="w-28 px-1.5 py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={expectedUnitPrice ?? ''}
          onChange={(e) => setExpectedUnitPrice(e.target.value === '' ? undefined : e.target.valueAsNumber)}
          onBlur={saveFields}
          className="h-8 text-xs"
        />
      </td>
      <td className="w-28 px-1.5 py-2 tabular-nums text-sm font-semibold">{formatCurrency(total)}</td>
      <td className="w-12 px-1.5 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          title="حذف الصنف"
          disabled={!canDelete || deleteItem.isPending}
          onClick={() => deleteItem.mutate(item.id)}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}
