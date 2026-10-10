import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useI18n } from '@/shared/i18n/useI18n'
import { useTheme } from '@/shared/theme/useTheme'

type IconName = keyof typeof Ionicons.glyphMap

export default function TabsLayout() {
  const { t } = useI18n()
  const { colors } = useTheme()
  // Filled icon when focused, outline otherwise — the active tab is never colour-only.
  const tab = (name: string, title: string, icon: IconName, activeIcon: IconName) => (
    <Tabs.Screen
      name={name}
      options={{
        title,
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? activeIcon : icon} size={size} color={color} />
      }}
    />
  )
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: 60, paddingTop: 4 }
      }}
    >
      {tab('home', t('tabs.home'), 'home-outline', 'home')}
      {tab('invoices', t('tabs.invoices'), 'receipt-outline', 'receipt')}
      {tab('parties', t('tabs.parties'), 'people-outline', 'people')}
      {/* Settings is reached from the header gear, not from the tab bar. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  )
}
