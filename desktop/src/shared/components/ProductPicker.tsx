import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@shared/components/ui/input'
import { apiClient } from '@shared/lib/api-client'
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue'
import { cn } from '@shared/lib/utils'
import type { Product } from '@shared/types/api'

export interface PickedProduct {
  id: number
  name: string
  unit?: string | null
  /** Carried through so callers (e.g. Purchase Orders) can default a price field to it. */
  lastPurchasePrice?: number | null
  averageCost?: number | null
}

interface ProductPickerProps {
  value: PickedProduct | null
  onChange: (product: PickedProduct | null) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Debounced search + dropdown over the existing Arabic-normalized product
 * search endpoint. Lives in shared/ (not modules/products/) because both
 * Invoices (line-item match) and Purchase Orders (line items) need it —
 * feature modules stay decoupled from each other, this is the shared piece.
 */
export function ProductPicker({ value, onChange, placeholder = 'ابحث عن منتج...', disabled }: ProductPickerProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query.trim(), 250)

  useEffect(() => {
    setQuery(value?.name ?? '')
  }, [value?.id, value?.name])

  const { data, isFetching } = useQuery({
    queryKey: ['product-picker', debouncedQuery],
    queryFn: () => apiClient.get<Product[]>(`/api/products/search?query=${encodeURIComponent(debouncedQuery)}`),
    enabled: open && debouncedQuery.length > 0
  })

  const results = data ?? []

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="ps-8"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (!e.target.value) onChange(null)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>

      {open && debouncedQuery.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {isFetching ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">جاري البحث...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">لا نتائج لـ "{debouncedQuery}"</div>
          ) : (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange({
                    id: product.id,
                    name: product.name,
                    unit: product.unit,
                    lastPurchasePrice: product.last_purchase_price,
                    averageCost: product.average_cost
                  })
                  setQuery(product.name)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start text-sm hover:bg-accent hover:text-accent-foreground',
                  value?.id === product.id && 'bg-accent/60'
                )}
              >
                <span className="font-medium">{product.name}</span>
                {product.category && <span className="text-xs text-muted-foreground">{product.category}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
