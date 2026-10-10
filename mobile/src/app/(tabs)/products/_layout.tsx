import { Stack } from 'expo-router'
import { useTheme } from '@/shared/theme/useTheme'

// A deep link straight to a detail screen must still have the list underneath it.
export const unstable_settings = { initialRouteName: 'index' }

export default function ProductsLayout() {
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
