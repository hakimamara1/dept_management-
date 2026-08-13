import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { ProductPicker } from '@shared/components/ProductPicker'
import type { SalesInvoiceItem } from '@shared/types/api'
import { useAddSalesInvoiceItem } from '../hooks/useSalesInvoiceMutations'
import { SalesInvoiceItemRow } from './SalesInvoiceItemRow'

interface SalesInvoiceItemsTableProps {
  customerId: number
  invoiceId: number
  items: SalesInvoiceItem[]
}

/** Draft-only editable items table — modeled on InvoiceItemsTable's proven pattern, simplified (no split/merge/matching). */
export function SalesInvoiceItemsTable({ customerId, invoiceId, items }: SalesInvoiceItemsTableProps) {
  const addItem = useAddSalesInvoiceItem(customerId, invoiceId)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [unitPrice, setUnitPrice] = useState<number | ''>('')

  function handleAdd() {
    if (!name.trim() || !quantity || quantity <= 0 || unitPrice === '' || unitPrice < 0) return
    addItem.mutate(
      { productName: name.trim(), unit: unit || undefined, quantity: Number(quantity), unitPrice: Number(unitPrice) },
      {
        onSuccess: () => {
          setName('')
          setUnit('')
          setQuantity('')
          setUnitPrice('')
        }
      }
    )
  }

  return (
    <div className="rounded-md border border-border">
      {/* overflow-x-auto only — vertical overflow must stay visible or the
          add-item row's ProductPicker dropdown below gets clipped by this
          container instead of floating over the page. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-start text-xs text-muted-foreground">
              <th className="py-2 ps-3 text-start">الصنف</th>
              <th className="py-2 text-start">الوحدة</th>
              <th className="py-2 text-start">الكمية</th>
              <th className="py-2 text-start">سعر الوحدة</th>
              <th className="py-2 pe-3 text-start">الإجمالي</th>
              <th className="py-2 pe-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <SalesInvoiceItemRow
                key={item.id}
                customerId={customerId}
                invoiceId={invoiceId}
                item={item}
                canDelete={items.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add-item controls live outside the table/scroll wrapper above so
          the ProductPicker dropdown — being the very last row — always has
          room to render below it instead of being clipped. */}
      <div className="flex flex-wrap items-end gap-2 border-t border-border p-2">
        <div className="min-w-[10rem] flex-[2]">
          <ProductPicker
            value={null}
            placeholder="اسم صنف جديد..."
            onQueryChange={setName}
            onChange={(product) => {
              if (!product) return
              setName(product.name)
              if (product.unit && !unit) setUnit(product.unit)
              if (product.defaultSalePrice != null && unitPrice === '') setUnitPrice(product.defaultSalePrice)
            }}
          />
        </div>
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="الوحدة" className="h-8 w-20 text-xs" />
        <Input
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? '' : e.target.valueAsNumber)}
          placeholder="الكمية"
          className="h-8 w-24 text-xs"
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value === '' ? '' : e.target.valueAsNumber)}
          placeholder="السعر"
          className="h-8 w-28 text-xs"
        />
        <Button type="button" variant="ghost" size="sm" onClick={handleAdd} disabled={addItem.isPending}>
          <Plus className="size-3.5" />
          إضافة صنف
        </Button>
      </div>
    </div>
  )
}
