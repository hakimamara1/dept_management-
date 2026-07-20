import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { ProductPicker, type PickedProduct } from '@shared/components/ProductPicker'
// Deliberate cross-module import: creating a catalog product from here is an
// explicit, opt-in action — see ProductPicker's onCreateNew.
import { CreateProductDialog } from '@modules/products/components/CreateProductDialog'
import type { PurchaseOrderItem } from '@shared/types/api'
import { useAddPurchaseOrderItem } from '../hooks/usePurchaseOrderMutations'
import { PurchaseOrderItemRow } from './PurchaseOrderItemRow'

interface PurchaseOrderItemsTableProps {
  orderId: number
  items: PurchaseOrderItem[]
  readOnly: boolean
}

/** Draft: fully editable — product/quantity/price per line, add/delete rows. Otherwise: plain read-only rows. */
export function PurchaseOrderItemsTable({ orderId, items, readOnly }: PurchaseOrderItemsTableProps) {
  const [newProduct, setNewProduct] = useState<PickedProduct | null>(null)
  const [newQuantity, setNewQuantity] = useState<number | undefined>(1)
  const [newPrice, setNewPrice] = useState<number | undefined>(undefined)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateName, setQuickCreateName] = useState('')
  const addItem = useAddPurchaseOrderItem(orderId)

  function handleAdd() {
    if (!newProduct || !newQuantity) return
    addItem.mutate(
      { productId: newProduct.id, quantity: newQuantity, expectedUnitPrice: newPrice },
      {
        onSuccess: () => {
          setNewProduct(null)
          setNewQuantity(1)
          setNewPrice(undefined)
        }
      }
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-start font-medium">المنتج</th>
              <th className="px-3 py-2 text-start font-medium">الكمية</th>
              <th className="px-3 py-2 text-start font-medium">السعر المتوقع</th>
              <th className="px-3 py-2 text-start font-medium">الإجمالي المتوقع</th>
              {!readOnly && <th className="px-3 py-2 text-start font-medium" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <PurchaseOrderItemRow key={item.id} orderId={orderId} item={item} readOnly={readOnly} canDelete={items.length > 1} />
            ))}
            {!readOnly && (
              <tr className="align-top">
                <td className="min-w-48 px-1.5 py-2">
                  <ProductPicker
                    value={newProduct}
                    onChange={setNewProduct}
                    placeholder="إضافة صنف..."
                    onCreateNew={(query) => {
                      setQuickCreateName(query)
                      setQuickCreateOpen(true)
                    }}
                  />
                </td>
                <td className="w-28 px-1.5 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newQuantity ?? ''}
                    onChange={(e) => setNewQuantity(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="w-28 px-1.5 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice ?? ''}
                    onChange={(e) => setNewPrice(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="w-28 px-1.5 py-2" />
                <td className="w-12 px-1.5 py-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={!newProduct || !newQuantity || addItem.isPending}
                    onClick={handleAdd}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateProductDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        defaultName={quickCreateName}
        trigger={false}
        onCreated={(product) => {
          setNewProduct(product)
          setQuickCreateOpen(false)
        }}
      />
    </div>
  )
}
