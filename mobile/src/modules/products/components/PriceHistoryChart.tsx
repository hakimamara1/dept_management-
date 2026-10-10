import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg'
import { AppText } from '@/shared/components/ui'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/shared/lib/format'
import { spacing, useTheme } from '@/shared/theme/useTheme'

export interface PricePoint {
  date: string
  value: number
  /** Supplier (buy) or customer (sell) — shown when a point is selected. */
  party: string | null
  quantity: number
}

export interface PriceSeries {
  key: string
  label: string
  color: string
  /** Second encoding besides colour, so the two lines stay distinguishable without it. */
  shape: 'circle' | 'diamond'
  dashed?: boolean
  points: PricePoint[]
}

const HEIGHT = 190
const PAD_X = 12
const PAD_TOP = 14
const PAD_BOTTOM = 14
const R = 4.5 // ≥ 8 px marker

const dayNumber = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : 0
}

function Marker({ x, y, shape, color, ring, size = R }: { x: number; y: number; shape: PriceSeries['shape']; color: string; ring: string; size?: number }) {
  if (shape === 'circle') return <Circle cx={x} cy={y} r={size} fill={color} stroke={ring} strokeWidth={2} />
  const s = size + 1.5
  return <Polygon points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`} fill={color} stroke={ring} strokeWidth={2} />
}

/**
 * Dated price lines (buy vs sell). Time runs left → right in every language, like the numbers on it.
 * Tap anywhere to read the nearest point; the same data is also listed as tables on the screen.
 */
export function PriceHistoryChart({ series, width, quantityLabel }: { series: PriceSeries[]; width: number; quantityLabel: string }) {
  const { colors } = useTheme()
  const [selected, setSelected] = useState<{ key: string; index: number } | null>(null)

  const layout = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (all.length === 0) return null
    const days = all.map((p) => dayNumber(p.date))
    const t0 = Math.min(...days)
    const t1 = Math.max(...days)
    const values = all.map((p) => p.value)
    let lo = Math.min(...values)
    let hi = Math.max(...values)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.12
    lo -= pad
    hi += pad
    const plotW = width - PAD_X * 2
    const x = (iso: string) => (t1 === t0 ? PAD_X + plotW / 2 : PAD_X + ((dayNumber(iso) - t0) / (t1 - t0)) * plotW)
    const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
    const firstDate = all.reduce((a, p) => (p.date < a ? p.date : a), all[0].date)
    const lastDate = all.reduce((a, p) => (p.date > a ? p.date : a), all[0].date)
    return { x, y, lo: lo + pad, hi: hi - pad, firstDate, lastDate }
  }, [series, width])

  if (!layout) return null
  const { x, y } = layout
  const chosen = selected ? series.find((s) => s.key === selected.key)?.points[selected.index] : undefined
  const chosenSeries = selected ? series.find((s) => s.key === selected.key) : undefined

  function pick(locationX: number) {
    let best: { key: string; index: number; d: number } | null = null
    for (const s of series) {
      s.points.forEach((p, index) => {
        const d = Math.abs(x(p.date) - locationX)
        if (!best || d < best.d) best = { key: s.key, index, d }
      })
    }
    if (best) setSelected({ key: (best as { key: string }).key, index: (best as { index: number }).index })
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ minHeight: 40, justifyContent: 'center' }}>
        {chosen && chosenSeries ? (
          <>
            <AppText variant="body" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {chosenSeries.label} · {formatCurrency(chosen.value)}
            </AppText>
            <AppText variant="caption">
              {formatDate(chosen.date)}{chosen.party ? ` · ${chosen.party}` : ''} · {quantityLabel} {chosen.quantity}
            </AppText>
          </>
        ) : (
          <AppText variant="caption">
            {formatCompactCurrency(layout.lo)} – {formatCompactCurrency(layout.hi)}
          </AppText>
        )}
      </View>

      <Pressable onPress={(e) => pick(e.nativeEvent.locationX)} accessibilityRole="image" accessibilityLabel={series.map((s) => s.label).join(' / ')}>
        <Svg width={width} height={HEIGHT}>
          {[0, 0.5, 1].map((f) => (
            <Line key={f} x1={PAD_X} x2={width - PAD_X} y1={PAD_TOP + f * (HEIGHT - PAD_TOP - PAD_BOTTOM)} y2={PAD_TOP + f * (HEIGHT - PAD_TOP - PAD_BOTTOM)} stroke={colors.border} strokeWidth={1} />
          ))}
          {selected && chosen ? <Line x1={x(chosen.date)} x2={x(chosen.date)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke={colors.mutedForeground} strokeWidth={1} strokeDasharray="3 3" /> : null}
          {series.map((s) => {
            if (s.points.length === 0) return null
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date)} ${y(p.value)}`).join(' ')
            return (
              <G key={s.key}>
                {s.points.length > 1 ? <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeDasharray={s.dashed ? '7 5' : undefined} /> : null}
              </G>
            )
          })}
          {series.flatMap((s) =>
            s.points.map((p, i) => (
              <Marker
                key={`${s.key}-${i}`}
                x={x(p.date)}
                y={y(p.value)}
                shape={s.shape}
                color={s.color}
                ring={colors.card}
                size={selected?.key === s.key && selected.index === i ? R + 2 : R}
              />
            ))
          )}
        </Svg>
      </Pressable>

      {/* direction: 'ltr' — the time axis always runs left → right, so its labels must not mirror in RTL. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' }}>
        <AppText variant="caption">{formatDate(layout.firstDate)}</AppText>
        <AppText variant="caption">{formatDate(layout.lastDate)}</AppText>
      </View>

      {/* Legend always present with 2+ series: marker shape + line style + name, never colour alone. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Svg width={34} height={14}>
              <Line x1={0} x2={34} y1={7} y2={7} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '7 5' : undefined} />
              <Marker x={17} y={7} shape={s.shape} color={s.color} ring={colors.card} />
            </Svg>
            <AppText variant="caption">{s.label}{s.points.length === 0 ? ' —' : ''}</AppText>
          </View>
        ))}
      </View>
    </View>
  )
}
