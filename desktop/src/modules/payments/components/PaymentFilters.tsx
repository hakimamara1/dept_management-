import { X } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { DateRangeFilter } from '@shared/components/DateRangeFilter'
import { SupplierPicker, type PickedSupplier } from '@shared/components/SupplierPicker'
import type { DashboardRange } from '@shared/types/api'

interface PaymentFiltersProps {
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  supplier: PickedSupplier | null
  onSupplierChange: (supplier: PickedSupplier | null) => void
}

/** One shared filter bar driving the KPIs, charts and table below it. */
export function PaymentFilters({ supplier, onSupplierChange, ...dateProps }: PaymentFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <DateRangeFilter {...dateProps} />
      <div className="flex w-64 items-center gap-1">
        <div className="flex-1">
          <SupplierPicker value={supplier} onChange={onSupplierChange} placeholder="كل الموردين — ابحث عن مورد..." />
        </div>
        {supplier && (
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onSupplierChange(null)} aria-label="إزالة فلتر المورد">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
