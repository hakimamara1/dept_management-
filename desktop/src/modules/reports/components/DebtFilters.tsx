import { X } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { DateRangeFilter } from '@shared/components/DateRangeFilter'
import { SupplierPicker, type PickedSupplier } from '@shared/components/SupplierPicker'
import { CustomerPicker, type PickedCustomer } from '@shared/components/CustomerPicker'
import type { DashboardRange, DebtScope } from '@shared/types/api'

interface DebtFiltersProps {
  scope: DebtScope
  onScopeChange: (scope: DebtScope) => void
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  entity: PickedSupplier | PickedCustomer | null
  onEntityChange: (entity: PickedSupplier | PickedCustomer | null) => void
}

const SCOPES: { value: DebtScope; label: string }[] = [
  { value: 'suppliers', label: 'ديون الموردين' },
  { value: 'customers', label: 'ديون العملاء' }
]

export function DebtFilters({ scope, onScopeChange, entity, onEntityChange, ...dateProps }: DebtFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-border p-1">
        {SCOPES.map((s) => (
          <Button key={s.value} size="sm" variant={scope === s.value ? 'default' : 'ghost'} onClick={() => onScopeChange(s.value)}>
            {s.label}
          </Button>
        ))}
      </div>

      <DateRangeFilter {...dateProps} />

      <div className="flex w-64 items-center gap-1">
        <div className="flex-1">
          {scope === 'suppliers' ? (
            <SupplierPicker value={entity} onChange={onEntityChange} placeholder="كل الموردين — ابحث عن مورد..." />
          ) : (
            <CustomerPicker value={entity} onChange={onEntityChange} placeholder="كل العملاء — ابحث عن عميل..." />
          )}
        </div>
        {entity && (
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onEntityChange(null)} aria-label="إزالة الفلتر">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
