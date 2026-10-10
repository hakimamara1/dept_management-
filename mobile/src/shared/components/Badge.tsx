import { Text, View } from 'react-native'
import { radius, useTheme } from '@/shared/theme/useTheme'

/** Small pill label (party type, status). Colour is never the only signal — the text always carries the meaning. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'warning' | 'success' }) {
  const { colors } = useTheme()
  const palette = {
    neutral: { bg: colors.muted, fg: colors.mutedForeground },
    primary: { bg: colors.accent, fg: colors.accentForeground },
    warning: { bg: colors.muted, fg: colors.warning },
    success: { bg: colors.muted, fg: colors.success }
  }[tone]
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: palette.bg }}>
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

/** Round icon holder used as a list row's leading element. */
export function IconBubble({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'neutral' }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'primary' ? colors.accent : colors.muted
      }}
    >
      {children}
    </View>
  )
}
