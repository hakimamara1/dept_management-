import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useI18n } from '@/shared/i18n/useI18n'
import { useTheme } from '@/shared/theme/useTheme'

export default function TabsLayout() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const tab = (name: string, title: string, icon: keyof typeof Ionicons.glyphMap) => (
    <Tabs.Screen
      name={name}
      options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} /> }}
    />
  )
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: 56 }
      }}
    >
      {tab('home', t('tabs.home'), 'home-outline')}
      {tab('invoices', t('tabs.invoices'), 'receipt-outline')}
      {tab('suppliers', t('tabs.suppliers'), 'people-outline')}
      {tab('customers', t('tabs.customers'), 'storefront-outline')}
      {tab('settings', t('tabs.settings'), 'settings-outline')}
    </Tabs>
  )
}
