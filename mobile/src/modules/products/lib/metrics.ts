import type { Product } from '@desktop-types/api'

/** What one unit costs us: the weighted average when known, else the last purchase price. */
export const unitCost = (p: Pick<Product, 'average_cost' | 'last_purchase_price'>): number | null =>
  p.average_cost ?? p.last_purchase_price ?? null

/** Profit per unit; null when either side is unknown. */
export const marginAmount = (sale: number | null | undefined, cost: number | null | undefined): number | null =>
  sale != null && cost != null ? sale - cost : null

/** Profit as a share of the sale price: (sale − cost) ÷ sale. Null when the sale price is missing or zero. */
export const marginPercent = (sale: number | null | undefined, cost: number | null | undefined): number | null =>
  sale != null && sale > 0 && cost != null ? ((sale - cost) / sale) * 100 : null

export type RangeKey = '3m' | '6m' | '1y' | 'all'

/** Keeps points on or after the cutoff for the chosen window (relative to `now`). */
export function inRange<T extends { date: string }>(points: T[], range: RangeKey, now = new Date()): T[] {
  if (range === 'all') return points
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  return points.filter((p) => p.date >= iso)
}

/** Per-supplier summary of purchase points: last price, cheapest, how many times bought. */
export function bySupplier(points: { date: string; price: number; supplier: string | null }[]) {
  const map = new Map<string, { name: string; last: number; lastDate: string; min: number; count: number }>()
  for (const p of points) {
    const name = p.supplier ?? '—'
    const row = map.get(name)
    if (!row) map.set(name, { name, last: p.price, lastDate: p.date, min: p.price, count: 1 })
    else {
      row.count += 1
      row.min = Math.min(row.min, p.price)
      if (p.date >= row.lastDate) { row.last = p.price; row.lastDate = p.date }
    }
  }
  return [...map.values()].sort((a, b) => a.last - b.last) // cheapest current price first
}
