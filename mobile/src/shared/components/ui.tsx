import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MIN_TOUCH, elevation, radius, spacing, useTheme } from '@/shared/theme/useTheme'

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const { colors } = useTheme()
  const content = padded ? { padding: spacing.lg, gap: spacing.lg } : undefined
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={[{ flexGrow: 1 }, content]}>{children}</ScrollView> : <View style={[{ flex: 1 }, content]}>{children}</View>}
    </SafeAreaView>
  )
}

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: 'title' | 'heading' | 'body' | 'caption' | 'muted' }) {
  const { colors } = useTheme()
  const base = {
    title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground },
    heading: { fontSize: 17, fontWeight: '600' as const, color: colors.foreground },
    body: { fontSize: 15, color: colors.foreground },
    caption: { fontSize: 12, color: colors.mutedForeground },
    muted: { fontSize: 14, color: colors.mutedForeground }
  }[variant]
  return <Text {...props} style={[base, style]} />
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, isDark } = useTheme()
  return (
    <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, isDark ? null : elevation.card, style]}>
      {children}
    </View>
  )
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive'
  loading?: boolean
  disabled?: boolean
}) {
  const { colors } = useTheme()
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    destructive: { bg: 'transparent', fg: colors.destructive, border: colors.destructive }
  }[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        opacity: inactive ? 0.5 : pressed ? 0.8 : 1
      })}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : <Text style={{ color: palette.fg, fontSize: 16, fontWeight: '600' }}>{label}</Text>}
    </Pressable>
  )
}

export function CenteredMessage({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
      {body ? <AppText variant="muted" style={{ textAlign: 'center' }}>{body}</AppText> : null}
      {children}
    </View>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: active ? colors.card : 'transparent' }}
          >
            <Text style={{ color: active ? colors.primary : colors.mutedForeground, fontWeight: active ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function KpiTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const { colors } = useTheme()
  const color = tone === 'good' ? colors.success : tone === 'bad' ? colors.destructive : colors.foreground
  return (
    <Card style={{ flex: 1, minWidth: '45%', padding: spacing.md }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading" style={{ color, fontVariant: ['tabular-nums'] }}>{value}</AppText>
    </Card>
  )
}

export function TextField({ value, onChangeText, placeholder, keyboardType, multiline, onBlur }: { value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'decimal-pad' | 'numeric'; multiline?: boolean; onBlur?: () => void }) {
  const { colors } = useTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      autoCorrect={false}
      keyboardType={keyboardType}
      multiline={multiline}
      onBlur={onBlur}
      style={{
        minHeight: MIN_TOUCH,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        color: colors.foreground,
        backgroundColor: colors.card,
        fontSize: 15
      }}
    />
  )
}

export function ListRow({
  title,
  subtitle,
  trailing,
  trailingCaption,
  trailingColor,
  leading,
  onPress
}: {
  title: string
  subtitle?: string
  trailing?: string
  trailingCaption?: string
  trailingColor?: string
  leading?: ReactNode
  onPress?: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.muted : colors.card
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
      {trailing ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: trailingColor ?? colors.foreground, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{trailing}</Text>
          {trailingCaption ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{trailingCaption}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  )
}
