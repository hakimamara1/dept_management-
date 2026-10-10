import { useEffect, useRef } from 'react'
import { Animated, View, type DimensionValue } from 'react-native'
import { radius, spacing, useTheme } from '@/shared/theme/useTheme'

/** A pulsing placeholder block — used instead of spinners so a screen keeps its shape while loading. */
export function Skeleton({ width = '100%', height = 14, round = false }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={{ width, height, opacity, borderRadius: round ? radius.pill : radius.sm, backgroundColor: colors.muted }} />
}

/** Placeholder for a list of two-line rows with an amount on the far side. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  const { colors } = useTheme()
  return (
    <View accessibilityLabel="loading">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <Skeleton width={40} height={40} round />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
          <Skeleton width={64} height={16} />
        </View>
      ))}
    </View>
  )
}
