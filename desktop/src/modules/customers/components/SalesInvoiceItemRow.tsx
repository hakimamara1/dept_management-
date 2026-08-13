import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { formatCurrency } from '@shared/lib/format'
import type { SalesInvoiceItem } from '@shared/types/api'
import { useDeleteSalesInvoiceItem, useUpdateSalesInvoiceItem } from '../hooks/useSalesInvoiceMutations'

interface SalesInvoiceItemRowProps {
  customerId: number
  invoiceId: number
  item: SalesInvoiceItem
  canDelete: boolean
}

/** One editable line of a Draft sales invoice — save-on-blur, same interaction as InvoiceItemRow on the purchase side. */
export function SalesInvoiceItemRow({ customerId, invoiceId, item, canDelete }: SalesInvoiceItemRowProps) {
  const [name, setName] = useState(item.product_name)
  const [unit, setUnit] = useState(item.unit ?? '')
  const [quantity, setQuantity] = useState(item.quantity)
  const [unitPrice, setUnitPrice] = useState(item.unit_price)

  const updateItem = useUpdateSalesInvoiceItem(customerId, invoiceId)
  const deleteItem = useDeleteSalesInvoiceItem(customerId, invoiceId)
  const total = Number(quantity || 0) * Number(unitPrice || 0)

  function saveFields() {
    if (name.trim() === item.product_name && unit === (item.unit ?? '') && quantity === item.quantity && unitPrice === item.unit_price) {
      return
    }
    updateItem.mutate({ itemId: item.id, data: { productName: name, unit: unit || undefined, quantity, unitPrice } })
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 ps-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveFields} className="h-8 text-xs" />
      </td>
      <td className="py-2">
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} onBlur={saveFields} placeholder="الوحدة" className="h-8 w-20 text-xs" />
      </td>
      <td className="py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.valueAsNumber)}
          onBlur={saveFields}
          className="h-8 w-24 tabular-nums text-xs"
        />
      </td>
      <td className="py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.valueAsNumber)}
          onBlur={saveFields}
          className="h-8 w-28 tabular-nums text-xs"
        />
      </td>
      <td className="tabular-nums py-2 pe-3 font-medium">{formatCurrency(total)}</td>
      <td className="py-2 pe-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canDelete || deleteItem.isPending}
          onClick={() => deleteItem.mutate(item.id)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}
