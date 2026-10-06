import { Alert, View } from 'react-native'
import { AppButton, AppText, Card, Screen } from '@/shared/components/ui'
import { LANGUAGES } from '@/shared/i18n/dictionaries'
import { useI18n, useLanguageStore } from '@/shared/i18n/useI18n'
import { restartApp } from '@/shared/lib/restart'
import { useConnectionStore } from '@/modules/connection/store'

export default function SettingsScreen() {
  const { t, language } = useI18n()
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const connection = useConnectionStore((s) => s.connection)
  const clear = useConnectionStore((s) => s.clear)

  async function changeLanguage(next: typeof language) {
    if (next === language) return
    const needsRestart = await setLanguage(next)
    if (needsRestart) {
      // Layout direction only applies after a reload; if the platform won't reload, the user restarts manually.
      Alert.alert(t('settings.restartForLayout'), '', [{ text: 'OK', onPress: () => { restartApp() } }])
    }
  }

  function confirmUnpair() {
    Alert.alert(t('settings.unpair'), t('settings.unpairConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.unpair'), style: 'destructive', onPress: () => { clear() } }
    ])
  }

  return (
    <Screen>
      <AppText variant="title">{t('tabs.settings')}</AppText>

      <Card>
        <AppText variant="heading">{t('connection.title')}</AppText>
        <AppText variant="muted">{connection?.desktopName}</AppText>
        <AppText variant="caption" style={{ writingDirection: 'ltr', textAlign: 'left' }}>
          {connection?.lastHost}:{connection?.port}
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading">{t('settings.language')}</AppText>
        <View style={{ gap: 8 }}>
          {LANGUAGES.map((l) => (
            <AppButton key={l.value} label={l.label} variant={l.value === language ? 'primary' : 'outline'} onPress={() => changeLanguage(l.value)} />
          ))}
        </View>
      </Card>

      <AppButton variant="destructive" label={t('settings.unpair')} onPress={confirmUnpair} />
    </Screen>
  )
}
