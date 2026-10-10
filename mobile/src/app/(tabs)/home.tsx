import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/shared/components/ui'
import { AppText } from '@/shared/components/ui'
import { ScreenHeader } from '@/shared/components/ScreenHeader'
import { useI18n } from '@/shared/i18n/useI18n'
import { radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { DebtSummary } from '@/modules/reports/components/DebtSummary'
import { useConnectionStore } from '@/modules/connection/store'
import { usePendingInvoices } from '@/modules/invoices/hooks/useInvoices'

type IconName = keyof typeof Ionicons.glyphMap

function QuickAction({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 92,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.accent : colors.card,
        borderWidth: 1,
        borderColor: colors.border
      })}
    >
      <View>
        <Ionicons name={icon} size={28} color={colors.primary} />
        {badge ? (
          <View style={{ position: 'absolute', top: -6, end: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={{ color: colors.foreground, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  )
}

export default function HomeScreen() {
  const { t } = useI18n()
  const router = useRouter()
  const connection = useConnectionStore((s) => s.connection)
  const pending = usePendingInvoices()

  return (
    <Screen>
      <ScreenHeader title={t('tabs.home')} subtitle={connection?.desktopName} />

      <AppText variant="heading">{t('home.quickActions')}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <QuickAction icon="camera-outline" label={t('scan.scan')} onPress={() => router.push('/invoices/scan')} />
        <QuickAction icon="documents-outline" label={t('home.pendingCount')} badge={pending.data?.length} onPress={() => router.push('/invoices')} />
        <QuickAction icon="cash-outline" label={t('money.recordPayment')} onPress={() => router.push('/parties')} />
      </View>

      <DebtSummary />
    </Screen>
  )
}
