import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { formatDate } from '@/shared/lib/format'
import { addMonths, parseISODate, startOfDay, toISODate } from '@/shared/lib/dates'
import { MIN_TOUCH, radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { AppText } from './ui'

export interface QuickPick {
  label: string
  /** Months from today. */
  months: number
}

/**
 * Calendar-date input: tap to open the system date picker (no typing, no ambiguous formats), optional quick picks
 * relative to today ("+ 3 months" is how shelf lives are usually known), and a clear button when optional.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder,
  clearLabel,
  quickPicks,
  clearable = false,
  error
}: {
  label: string
  value: string
  onChange: (iso: string) => void
  placeholder: string
  clearLabel?: string
  quickPicks?: QuickPick[]
  clearable?: boolean
  error?: string | null
}) {
  const { colors } = useTheme()

  function open() {
    DateTimePickerAndroid.open({
      value: parseISODate(value) ?? startOfDay(new Date()),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toISODate(date))
      }
    })
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="muted">{label}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={open}
          style={{
            flex: 1,
            minHeight: MIN_TOUCH,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.border,
            backgroundColor: colors.card
          }}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.mutedForeground} />
          <Text style={{ color: value ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>
            {value ? formatDate(value) : placeholder}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={() => onChange('')}
            style={{ width: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close-circle" size={24} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {quickPicks && quickPicks.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {quickPicks.map((q) => (
            <Pressable
              key={q.months}
              accessibilityRole="button"
              onPress={() => onChange(toISODate(addMonths(startOfDay(new Date()), q.months)))}
              style={{ minHeight: 40, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.accent }}
            >
              <Text style={{ color: colors.accentForeground, fontWeight: '600', fontSize: 13 }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <AppText variant="caption" style={{ color: colors.destructive }}>{error}</AppText> : null}
    </View>
  )
}
