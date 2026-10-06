import { View } from 'react-native'
import Svg, { Line, Path, Rect } from 'react-native-svg'
import { formatCompactCurrency } from '@/shared/lib/format'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { AppText } from './ui'

const HEIGHT = 160
const PAD = 8

function scale(values: number[]) {
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  return { min, max, y: (v: number) => PAD + (1 - (v - min) / span) * (HEIGHT - PAD * 2) }
}

/** Step-line area for a running balance (debt trend). Dependency-free: plain SVG paths. */
export function TrendChart({ points, width }: { points: { date: string; value: number }[]; width: number }) {
  const { colors } = useTheme()
  if (points.length === 0) return null
  const s = scale(points.map((p) => p.value))
  const x = (i: number) => PAD + (points.length === 1 ? (width - PAD * 2) / 2 : (i / (points.length - 1)) * (width - PAD * 2))
  let line = `M ${x(0)} ${s.y(points[0].value)}`
  for (let i = 1; i < points.length; i++) line += ` H ${x(i)} V ${s.y(points[i].value)}` // step: hold, then jump
  const area = `${line} V ${s.y(0)} H ${x(0)} Z`
  return (
    <View style={{ gap: spacing.xs }}>
      <Svg width={width} height={HEIGHT}>
        <Line x1={PAD} x2={width - PAD} y1={s.y(0)} y2={s.y(0)} stroke={colors.border} strokeWidth={1} />
        <Path d={area} fill={colors.destructive} fillOpacity={0.12} />
        <Path d={line} stroke={colors.destructive} strokeWidth={2} fill="none" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="caption">{formatCompactCurrency(s.min)}</AppText>
        <AppText variant="caption">{formatCompactCurrency(s.max)}</AppText>
      </View>
    </View>
  )
}

export interface BarSeries {
  key: string
  color: string
  label: string
  values: number[]
}

/** Grouped bars (one group per period), negatives drawn below the baseline. */
export function GroupedBars({ series, width }: { series: BarSeries[]; width: number }) {
  const { colors } = useTheme()
  const groups = series[0]?.values.length ?? 0
  if (groups === 0) return null
  const s = scale(series.flatMap((x) => x.values))
  const groupW = (width - PAD * 2) / groups
  const barW = Math.max(2, Math.min(18, (groupW - 4) / series.length))
  const baseline = s.y(0)
  return (
    <View style={{ gap: spacing.sm }}>
      <Svg width={width} height={HEIGHT}>
        <Line x1={PAD} x2={width - PAD} y1={baseline} y2={baseline} stroke={colors.border} strokeWidth={1} />
        {series.map((serie, si) =>
          serie.values.map((v, gi) => {
            const top = Math.min(s.y(v), baseline)
            const h = Math.max(1, Math.abs(s.y(v) - baseline))
            const bx = PAD + gi * groupW + (groupW - barW * series.length) / 2 + si * barW
            return <Rect key={`${serie.key}-${gi}`} x={bx} y={top} width={barW - 1} height={v === 0 ? 0 : h} rx={2} fill={serie.color} />
          })
        )}
      </Svg>
      {/* A legend is always shown for 2+ series so meaning never depends on colour alone. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {series.map((serie) => (
          <View key={serie.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: serie.color }} />
            <AppText variant="caption">{serie.label}</AppText>
          </View>
        ))}
      </View>
    </View>
  )
}
