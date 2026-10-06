import { View } from 'react-native'
import { AppText, Screen } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { useTheme } from '@/shared/theme/useTheme'
import { DebtSummary } from '@/modules/reports/components/DebtSummary'
import { useConnectionStore } from '@/modules/connection/store'

export default function HomeScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const connection = useConnectionStore((s) => s.connection)

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">{t('tabs.home')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success }} />
          <AppText variant="caption">{connection?.desktopName}</AppText>
        </View>
      </View>
      <DebtSummary />
    </Screen>
  )
}
