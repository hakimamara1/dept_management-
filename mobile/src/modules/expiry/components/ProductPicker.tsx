import { useState } from 'react'
import { Alert, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import type { Product } from '@desktop-types/api'
import { AppButton, AppText, Card, ListRow, TextField } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { useDebounced } from '@/shared/lib/useDebounced'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { ProductFormSheet } from '@/modules/products/components/ProductFormSheet'
import { productsApi } from '@/modules/products/services/products.api'
import { BarcodeScanner } from './BarcodeScanner'

/**
 * Chooses the product of a batch: type to search, scan its barcode, or create it on the spot.
 * Dedupes the search result (the alias join returns a product once per alias).
 */
export function ProductPicker({ value, onChange, disabled, error }: { value: Product | null; onChange: (p: Product | null) => void; disabled?: boolean; error?: string | null }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState<{ barcode?: string; name?: string } | null>(null)
  const q = useDebounced(text.trim())
  const results = useQuery({
    queryKey: ['product-search', 'expiry', q],
    queryFn: async () => [...new Map((await productsApi.search(q)).map((p) => [p.id, p])).values()].slice(0, 6),
    enabled: !value && q.length > 0
  })

  async function onScanned(code: string) {
    setScanning(false)
    try {
      const found = await productsApi.byBarcode(code)
      if (found.length > 0) return onChange(found[0])
      Alert.alert(t('expiry.scan.notFound'), `${code}\n${t('expiry.scan.notFoundBody')}`, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('expiry.product.new'), onPress: () => setCreating({ barcode: code }) }
      ])
    } catch (e) {
      Alert.alert(errorText(e, t))
    }
  }

  if (value) {
    return (
      <Card>
        <AppText variant="caption">{t('expiry.field.product')}</AppText>
        <AppText variant="heading">{value.name}</AppText>
        {value.barcode ? <AppText variant="caption">{value.barcode}</AppText> : null}
        {!disabled && <AppButton variant="outline" label={t('expiry.product.change')} onPress={() => onChange(null)} />}
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="muted">{t('expiry.field.product')}</AppText>
      <TextField value={text} onChangeText={setText} placeholder={t('expiry.product.search')} />
      {(results.data ?? []).length > 0 && (
        <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          {(results.data ?? []).map((p) => (
            <ListRow key={p.id} title={p.name} subtitle={p.barcode ?? undefined} onPress={() => { onChange(p); setText('') }} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppButton variant="outline" label={t('expiry.product.scan')} onPress={() => setScanning(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton variant="outline" label={t('expiry.product.new')} onPress={() => setCreating({ name: text.trim() || undefined })} />
        </View>
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={16} color={colors.destructive} />
          <AppText variant="caption" style={{ color: colors.destructive }}>{error}</AppText>
        </View>
      ) : null}

      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={onScanned} />
      <ProductFormSheet
        visible={creating != null}
        onClose={() => setCreating(null)}
        initialBarcode={creating?.barcode}
        initialName={creating?.name}
        onSaved={async (id) => {
          try {
            onChange(await productsApi.get(id))
          } catch (e) {
            Alert.alert(errorText(e, t))
          }
        }}
      />
    </View>
  )
}
