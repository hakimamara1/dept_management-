import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import type { DashboardRange } from '@shared/types/api'
import { DATE_RANGE_OPTIONS } from '../hooks/useDateRange'

interface DateRangeFilterProps {
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
}

export function DateRangeFilter({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={range} onValueChange={(v) => onRangeChange(v as DashboardRange)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {range === 'custom' && (
        <>
          <Input type="date" value={customFrom} onChange={(e) => onCustomFromChange(e.target.value)} className="w-40" />
          <span className="text-sm text-muted-foreground">إلى</span>
          <Input type="date" value={customTo} onChange={(e) => onCustomToChange(e.target.value)} className="w-40" />
        </>
      )}
    </div>
  )
}
