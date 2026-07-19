import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import type { InvoiceReviewItem } from '@shared/types/api'
import { useAddInvoiceItem, useDeleteInvoiceItem, useUpdateInvoiceItem } from '../hooks/useInvoiceMutations'
import { InvoiceItemRow } from './InvoiceItemRow'

interface InvoiceItemsTableProps {
  invoiceId: number
  items: InvoiceReviewItem[]
  readOnly: boolean
}

/**
 * Pending Review: fully editable — every field, add/delete/merge/split.
 * Approved: plain read-only rows, no inputs, no action buttons — the
 * backend rejects every mutation once the invoice isn't Pending Review
 * anyway, this just avoids showing controls that would silently fail.
 */
export function InvoiceItemsTable({ invoiceId, items, readOnly }: InvoiceItemsTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const addItem = useAddInvoiceItem(invoiceId)
  const updateItem = useUpdateInvoiceItem(invoiceId)
  const deleteItem = useDeleteInvoiceItem(invoiceId)

  function toggleSelect(itemId: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  function handleSplit(item: InvoiceReviewItem) {
    const half = Math.round((Number(item.quantity) / 2) * 100) / 100
    const remainder = Number(item.quantity) - half
    if (half <= 0 || remainder <= 0) {
      toast.error('الكمية صغيرة جداً للتقسيم')
      return
    }
    updateItem.mutate({ itemId: item.id, data: { quantity: half } })
    addItem.mutate({
      productName: item.ocr_product_name,
      unit: item.unit ?? undefined,
      quantity: remainder,
      unitPrice: item.unit_price,
      productId: item.product_id ?? undefined
    })
  }

  function handleMerge() {
    const ids = Array.from(selected)
    if (ids.length !== 2) return
    const first = items.find((i) => i.id === ids[0])
    const second = items.find((i) => i.id === ids[1])
    if (!first || !second) return

    updateItem.mutate(
      { itemId: first.id, data: { quantity: Number(first.quantity) + Number(second.quantity) } },
      { onSuccess: () => deleteItem.mutate(second.id) }
    )
    setSelected(new Set())
  }

  return (
    <div className="space-y-3">
      {!readOnly && selected.size === 2 && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>تم تحديد صنفين — سيتم دمجهما في صنف واحد بجمع الكميات</span>
          <Button type="button" size="sm" onClick={handleMerge}>
            دمج المحدد
          </Button>
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              {!readOnly && <th className="w-8 px-2 py-2" />}
              <th className="px-3 py-2 text-start font-medium">الصنف</th>
              <th className="px-3 py-2 text-start font-medium">الوحدة</th>
              <th className="px-3 py-2 text-start font-medium">الكمية</th>
              <th className="px-3 py-2 text-start font-medium">سعر الوحدة</th>
              <th className="px-3 py-2 text-start font-medium">الإجمالي</th>
              <th className="px-3 py-2 text-start font-medium">المطابقة</th>
              {!readOnly && <th className="px-3 py-2 text-start font-medium" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <InvoiceItemRow
                key={item.id}
                invoiceId={invoiceId}
                item={item}
                readOnly={readOnly}
                canDelete={items.length > 1}
                selected={selected.has(item.id)}
                onToggleSelect={(checked) => toggleSelect(item.id, checked)}
                onSplit={() => handleSplit(item)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={addItem.isPending}
          onClick={() => addItem.mutate({ productName: 'صنف جديد', quantity: 1, unitPrice: 0 })}
        >
          <Plus className="size-4" />
          إضافة صنف
        </Button>
      )}
    </div>
  )
}
