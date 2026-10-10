import { useEffect, useRef, useState } from 'react'
import { Modal, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton, AppText } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { radius, spacing, useTheme } from '@/shared/theme/useTheme'

/** Full-screen barcode reader. Reports the first code it sees once, then closes — no double scans. */
export function BarcodeScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (code: string) => void }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const handled = useRef(false)
  const [, force] = useState(0)

  useEffect(() => {
    if (visible) { handled.current = false; force((n) => n + 1) }
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ padding: spacing.lg }}>
          <AppText variant="heading" style={{ color: '#fff' }}>{t('expiry.scan.title')}</AppText>
        </View>
        <View style={{ flex: 1, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'center', backgroundColor: colors.card }}>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={({ data }) => {
                if (handled.current || !data) return
                handled.current = true
                onScanned(String(data).trim())
              }}
            />
          ) : (
            <View style={{ padding: spacing.xl, gap: spacing.md }}>
              <AppText variant="muted" style={{ textAlign: 'center' }}>{t('connection.cameraNeeded')}</AppText>
              <AppButton label={t('connection.grantCamera')} onPress={requestPermission} />
            </View>
          )}
        </View>
        {/* A light bar: the outline button's dark text would vanish on the black camera backdrop. */}
        <View style={{ margin: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card }}>
          <AppButton variant="outline" label={t('common.cancel')} onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  )
}
