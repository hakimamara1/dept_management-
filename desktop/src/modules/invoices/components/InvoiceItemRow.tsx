import { useState } from 'react'
import { Check, PackagePlus, Scissors, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { ProductPicker, type PickedProduct } from '@shared/components/ProductPicker'
import { formatCurrency } from '@shared/lib/format'
import type { InvoiceReviewItem } from '@shared/types/api'
import { useDeleteInvoiceItem, useUpdateInvoiceItem } from '../hooks/useInvoiceMutations'

const UNIT_OPTIONS = [
  { value: 'piece', label: 'قطعة' },
  { value: 'kg', label: 'كيلو' },
  { value: 'box', label: 'علبة' },
  { value: 'liter', label: 'لتر' },
  { value: 'g', label: 'غرام' }
]

interface InvoiceItemRowProps {
  invoiceId: number
  item: InvoiceReviewItem
  readOnly: boolean
  canDelete: boolean
  selected: boolean
  onToggleSelect: (checked: boolean) => void
  onSplit: () => void
}

/** One line of the Pending-Review editable table, or a plain read-only row once Approved. */
export function InvoiceItemRow({ invoiceId, item, readOnly, canDelete, selected, onToggleSelect, onSplit }: InvoiceItemRowProps) {
  const [name, setName] = useState(item.ocr_product_name)
  const [unit, setUnit] = useState(item.unit ?? '')
  const [quantity, setQuantity] = useState(item.quantity)
  const [unitPrice, setUnitPrice] = useState(item.unit_price)
  const [matchMode, setMatchMode] = useState<'idle' | 'search' | 'new'>('idle')
  const [newProductUnit, setNewProductUnit] = useState(item.unit || 'piece')

  const updateItem = useUpdateInvoiceItem(invoiceId)
  const deleteItem = useDeleteInvoiceItem(invoiceId)
  const isMatched = item.product_id != null
  const total = Number(quantity || 0) * Number(unitPrice || 0)

  function saveFields() {
    if (name.trim() === item.ocr_product_name && unit === (item.unit ?? '') && quantity === item.quantity && unitPrice === item.unit_price) {
      return
    }
    updateItem.mutate({ itemId: item.id, data: { productName: name, unit: unit || undefined, quantity, unitPrice } })
  }

  if (readOnly) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-2.5 align-middle">{item.ocr_product_name}</td>
        <td className="px-3 py-2.5 align-middle text-muted-foreground">{item.unit ?? '—'}</td>
        <td className="px-3 py-2.5 align-middle tabular-nums">{Number(item.quantity).toLocaleString('ar-DZ')}</td>
        <td className="px-3 py-2.5 align-middle tabular-nums">{formatCurrency(item.unit_price)}</td>
        <td className="px-3 py-2.5 align-middle tabular-nums font-semibold">{formatCurrency(item.total_price)}</td>
        <td className="px-3 py-2.5 align-middle">
          {isMatched ? (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check className="size-4 shrink-0" />
              {item.matched_product_name}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="w-8 px-2 py-2.5">
        <Checkbox checked={selected} onCheckedChange={(v) => onToggleSelect(!!v)} />
      </td>
      <td className="min-w-40 px-1.5 py-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveFields} className="h-8 text-xs" />
      </td>
      <td className="w-24 px-1.5 py-2">
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} onBlur={saveFields} placeholder="الوحدة" className="h-8 text-xs" />
      </td>
      <td className="w-24 px-1.5 py-2">
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
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.valueAsNumber)}
          onBlur={saveFields}
          className="h-8 text-xs"
        />
      </td>
      <td className="w-28 px-1.5 py-2 tabular-nums text-sm font-semibold">{formatCurrency(total)}</td>
      <td className="min-w-56 px-1.5 py-2">
        {matchMode === 'idle' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {isMatched ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5 shrink-0" />
                {item.matched_product_name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">غير مطابق</span>
            )}
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMatchMode('search')}>
              {isMatched ? 'تغيير' : 'اختيار منتج'}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMatchMode('new')}>
              <PackagePlus className="size-3.5" />
            </Button>
          </div>
        )}
        {matchMode === 'search' && (
          <div className="w-56">
            <ProductPicker
              value={null}
              onChange={(product: PickedProduct | null) => {
                if (product) {
                  updateItem.mutate({ itemId: item.id, data: { productId: product.id } })
                  setMatchMode('idle')
                }
              }}
            />
          </div>
        )}
        {matchMode === 'new' && (
          <div className="flex items-center gap-1.5">
            <Select value={newProductUnit} onValueChange={setNewProductUnit}>
              <SelectTrigger className="h-8 w-24 text-xs">
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
            <Button
              type="button"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                updateItem.mutate({ itemId: item.id, data: { createNewProduct: { unit: newProductUnit } } })
                setMatchMode('idle')
              }}
            >
              حفظ
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setMatchMode('idle')}>
              إلغاء
            </Button>
          </div>
        )}
      </td>
      <td className="w-20 px-1.5 py-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="size-7" title="تقسيم الصنف" onClick={onSplit}>
            <Scissors className="size-3.5" />
          </Button>
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
        </div>
      </td>
    </tr>
  )
}
