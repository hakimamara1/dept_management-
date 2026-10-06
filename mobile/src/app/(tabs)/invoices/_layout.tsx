import { Stack } from 'expo-router'
import { useTheme } from '@/shared/theme/useTheme'

export default function InvoicesLayout() {
  const { colors } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.foreground },
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}
