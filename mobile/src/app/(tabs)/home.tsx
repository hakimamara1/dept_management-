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
import { useExpiryBatches } from '@/modules/expiry/hooks/useExpiry'
import { groupBatches } from '@/modules/expiry/lib/urgency'

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
  const { colors } = useTheme()
  const connection = useConnectionStore((s) => s.connection)
  const pending = usePendingInvoices()
  const expiry = useExpiryBatches()
  const expiryGroups = expiry.data ? groupBatches(expiry.data) : null

  return (
    <Screen>
      <ScreenHeader title={t('tabs.home')} subtitle={connection?.desktopName} />

      <AppText variant="heading">{t('home.quickActions')}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <QuickAction icon="camera-outline" label={t('scan.scan')} onPress={() => router.push('/invoices/scan')} />
        <QuickAction icon="documents-outline" label={t('home.pendingCount')} badge={pending.data?.length} onPress={() => router.push('/invoices')} />
        <QuickAction icon="cash-outline" label={t('money.recordPayment')} onPress={() => router.push('/parties')} />
      </View>

      {expiryGroups && (expiryGroups.expired.length > 0 || expiryGroups.week.length > 0) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.expiry')}
          onPress={() => router.push('/expiry')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: expiryGroups.expired.length > 0 ? colors.destructive : colors.warning,
            backgroundColor: pressed ? colors.accent : colors.card
          })}
        >
          <Ionicons name={expiryGroups.expired.length > 0 ? 'close-circle' : 'alert-circle'} size={28} color={expiryGroups.expired.length > 0 ? colors.destructive : colors.warning} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{t('home.expiry')}</AppText>
            <AppText variant="muted">
              {expiryGroups.expired.length > 0 ? `${t('expiry.bucket.expired')}: ${expiryGroups.expired.length}` : ''}
              {expiryGroups.expired.length > 0 && expiryGroups.week.length > 0 ? ' · ' : ''}
              {expiryGroups.week.length > 0 ? `${t('expiry.bucket.week')}: ${expiryGroups.week.length}` : ''}
            </AppText>
          </View>
        </Pressable>
      ) : null}

      <DebtSummary />
    </Screen>
  )
}
