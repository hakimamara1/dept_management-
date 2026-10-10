import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useI18n } from '@/shared/i18n/useI18n'
import { MIN_TOUCH, radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { useConnectionStore } from '@/modules/connection/store'
import { AppText } from './ui'

/**
 * Title row shared by the main tabs: title (+ subtitle) at the start; connection dot and the Settings gear at the end.
 * Settings is no longer a tab — it is always one tap away from here.
 */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const status = useConnectionStore((s) => s.status)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="caption" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {right}
      <View
        accessibilityLabel={status === 'connected' ? t('connection.connectedTo') : t('connection.unreachableTitle')}
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: status === 'connected' ? colors.success : colors.warning }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.settings')}
        onPress={() => router.push('/settings')}
        hitSlop={8}
        style={({ pressed }) => ({
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.muted : 'transparent'
        })}
      >
        <Ionicons name="settings-outline" size={24} color={colors.mutedForeground} />
      </Pressable>
    </View>
  )
}
