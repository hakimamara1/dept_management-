import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { ApiError, newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, CenteredMessage, Screen } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { useExtractInvoice } from '@/modules/invoices/hooks/useInvoices'
import { preparePhoto } from '@/modules/invoices/lib/preparePhoto'

type Photo = { uri: string; name: string; type: string }

/** Take (or receive from the gallery) a photo → shrink → upload → the desktop's AI reads it → open the review. */
export default function ScanScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const { uri: galleryUri } = useLocalSearchParams<{ uri?: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const camera = useRef<CameraView>(null)
  const extract = useExtractInvoice()
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [preparing, setPreparing] = useState(false)
  const key = useRef(newIdempotencyKey())
  const started = useRef(false)

  function upload(p: Photo) {
    extract.mutate(
      { photo: p, key: key.current },
      {
        onSuccess: (res) => router.replace(`/invoices/${res.invoiceId}`),
        onError: (e) => {
          // Nothing was created after a definitive rejection → fresh key. After a network failure/timeout
          // the desktop may still be reading the photo, so a retry must reuse the key (replay, no duplicate).
          if (e instanceof ApiError && e.code === 'HTTP') key.current = newIdempotencyKey()
          Alert.alert(t('scan.failed'), e.message)
        }
      }
    )
  }

  async function handle(uri: string) {
    setPreparing(true)
    try {
      const prepared = await preparePhoto(uri)
      setPhoto(prepared)
      upload(prepared)
    } catch (e) {
      Alert.alert(t('scan.failed'), e instanceof Error ? e.message : '')
    } finally {
      setPreparing(false)
    }
  }

  useEffect(() => {
    if (galleryUri && !started.current) {
      started.current = true
      handle(galleryUri)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryUri])

  async function capture() {
    const shot = await camera.current?.takePictureAsync({ quality: 1, skipProcessing: false })
    if (shot?.uri) handle(shot.uri)
  }

  const busy = preparing || extract.isPending
  if (busy) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: t('scan.scan') }} />
        <CenteredMessage title={preparing ? t('scan.preparing') : t('scan.reading')} body={extract.isPending ? t('scan.readingHint') : undefined}>
          <ActivityIndicator size="large" color={colors.primary} />
        </CenteredMessage>
      </Screen>
    )
  }

  if (photo && extract.isError) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: t('scan.scan') }} />
        <CenteredMessage title={t('scan.failed')} body={extract.error.message}>
          <AppButton label={t('common.retry')} onPress={() => upload(photo)} />
          <AppButton variant="outline" label={t('scan.retake')} onPress={() => { setPhoto(null); extract.reset() }} />
        </CenteredMessage>
      </Screen>
    )
  }

  if (!galleryUri && !permission) return <Screen><View /></Screen>
  if (!galleryUri && !permission?.granted) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: t('scan.scan') }} />
        <CenteredMessage title={t('scan.scan')} body={t('connection.cameraNeeded')}>
          <AppButton label={t('connection.grantCamera')} onPress={requestPermission} />
        </CenteredMessage>
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('scan.scan') }} />
      <AppText variant="muted">{t('scan.hint')}</AppText>
      <View style={{ aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
      </View>
      <AppButton label={t('scan.capture')} onPress={capture} />
      <View style={{ height: spacing.md }} />
    </Screen>
  )
}
