import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Device from 'expo-device'
import { AppButton, AppText, CenteredMessage, Screen } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { radius, spacing } from '@/shared/theme/useTheme'
import { PairingError, pairWithDesktop, parsePairPayload, type PairPayload } from '@/modules/connection/services/pairing'

export default function PairScreen() {
  const { t } = useI18n()
  const [permission, requestPermission] = useCameraPermissions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<PairPayload | null>(null)
  const handling = useRef(false) // the scanner fires many times per second for one QR
  // Opened from a spiceerp://pair?d=… link (e.g. the phone's own camera app): pair without scanning.
  const { d } = useLocalSearchParams<{ d?: string }>()

  async function onScanned(data: string, needsConfirmation = false) {
    if (handling.current) return
    handling.current = true
    setBusy(true)
    setError(null)
    try {
      const payload = parsePairPayload(data)
      if (needsConfirmation) {
        // A link can come from anywhere (a chat, a web page). Never pair with it silently.
        setConfirm(payload)
        setBusy(false)
        handling.current = false
        return
      }
      await pairWithDesktop(payload, Device.modelName ?? Device.deviceName ?? 'Android')
      // On success the connection store flips to 'connected' and the root layout navigates to the app.
    } catch (err) {
      if (err instanceof PairingError) {
        setError(err.kind === 'invalid-qr' ? t('connection.invalidQr') : err.kind === 'unreachable' ? t('connection.noHostReachable') : err.message)
      } else {
        setError(t('connection.pairFailed'))
      }
      setBusy(false)
      // Give the user a moment to read the error before the next scan can start.
      setTimeout(() => {
        handling.current = false
      }, 1500)
    }
  }

  useEffect(() => {
    if (d) onScanned(`spiceerp://pair?d=${encodeURIComponent(d)}`, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])

  if (confirm) {
    return (
      <Screen scroll={false}>
        <CenteredMessage title={t('connection.confirmTitle')} body={`${confirm.name || '—'}\n${confirm.hosts[0]}:${confirm.port}\n\n${t('connection.confirmBody')}`}>
          <AppButton label={t('connection.confirmPair')} onPress={() => { const c = confirm; setConfirm(null); onScanned(`spiceerp://pair?d=${encodeURIComponent(JSON.stringify(c))}`) }} />
          <AppButton variant="outline" label={t('common.cancel')} onPress={() => setConfirm(null)} />
        </CenteredMessage>
      </Screen>
    )
  }
  if (d && busy) return <Screen scroll={false}><CenteredMessage title={t('connection.scanning')} /></Screen>
  if (!permission) return <Screen><View /></Screen>
  if (!permission.granted) {
    return (
      <Screen scroll={false}>
        <CenteredMessage title={t('connection.scanTitle')} body={t('connection.cameraNeeded')}>
          <AppButton label={t('connection.grantCamera')} onPress={requestPermission} />
        </CenteredMessage>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppText variant="title">{t('connection.scanTitle')}</AppText>
      <AppText variant="muted">{t('connection.scanHint')}</AppText>
      <View style={{ aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy ? undefined : ({ data }) => onScanned(data)}
        />
      </View>
      {busy && <AppText variant="muted" style={{ textAlign: 'center' }}>{t('connection.scanning')}</AppText>}
      {error && <AppText style={{ textAlign: 'center', color: '#b3261e' }} accessibilityRole="alert">{error}</AppText>}
      <View style={{ height: spacing.md }} />
    </Screen>
  )
}
