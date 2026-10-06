import { View } from 'react-native'
import { AppText, Card } from '@/shared/components/ui'
import { useTheme } from '@/shared/theme/useTheme'
import type { DebtVerdict } from '../lib/debtVerdict'

export function DebtVerdictBanner({ verdict }: { verdict: DebtVerdict }) {
  const { colors } = useTheme()
  const tone = verdict.status === 'down' ? colors.success : verdict.status === 'up' ? colors.destructive : colors.warning
  return (
    <Card style={{ borderColor: tone, borderWidth: 1.5 }}>
      <AppText variant="heading" style={{ lineHeight: 24 }}>{verdict.title}</AppText>
      <View style={{ gap: 4 }}>
        {verdict.lines.map((line, i) => (
          <AppText key={i} variant="muted" style={{ lineHeight: 20 }}>{line}</AppText>
        ))}
      </View>
    </Card>
  )
}
