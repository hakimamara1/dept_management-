import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import type { Product } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { normalizeName } from '@/shared/lib/normalizeName'
import { parseNumber } from '@/shared/lib/numbers'
import { toast } from '@/shared/lib/toast'
import { radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { useProductMutations, useProducts } from '../hooks/useProducts'

const UNITS = ['piece', 'kg', 'box', 'liter', 'g'] as const

/** Create (no `product`) or edit catalogue fields. The sale price of an existing product has its own sheet. */
export function ProductFormSheet({ visible, onClose, product, onSaved }: { visible: boolean; onClose: () => void; product?: Product; onSaved?: (id: number) => void }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const m = useProductMutations()
  const all = useProducts('') // cached list — used for the duplicate-name warning
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<string>('piece')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = useRef(newIdempotencyKey())

  // Re-seed whenever the sheet opens; one key per open so a retry of the same save replays, never duplicates.
  useEffect(() => {
    if (!visible) return
    setName(product?.name ?? '')
    setUnit(product?.unit ?? 'piece')
    setBarcode(product?.barcode ?? '')
    setCategory(product?.category ?? '')
    setPrice('')
    setError(null)
    key.current = newIdempotencyKey()
  }, [visible, product])

  const busy = m.create.isPending || m.update.isPending

  function save(force = false) {
    const trimmed = name.trim()
    if (!trimmed) return setError(t('products.nameRequired'))
    const salePrice = price.trim() === '' ? undefined : parseNumber(price)
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice < 0)) return setError(t('products.invalidPrice'))

    if (product) {
      m.update.mutate(
        { id: product.id, key: key.current, data: { name: trimmed, unit, barcode: barcode.trim() || null, category: category.trim() || null } },
        { onSuccess: () => { toast(t('money.done')); onSaved?.(product.id); onClose() }, onError: (e) => setError(errorText(e, t)) }
      )
      return
    }

    const wanted = normalizeName(trimmed)
    const twin = (all.data ?? []).find((p) => normalizeName(p.name) === wanted)
    if (twin && !force) {
      Alert.alert(t('products.duplicate'), `${twin.name}\n${t('products.duplicateBody')}`, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('products.createAnyway'), onPress: () => save(true) }
      ])
      return
    }
    m.create.mutate(
      { key: key.current, data: { name: trimmed, unit, barcode: barcode.trim() || undefined, category: category.trim() || undefined, defaultSalePrice: salePrice } },
      { onSuccess: (r) => { toast(t('money.done')); onSaved?.(r.id); onClose() }, onError: (e) => setError(errorText(e, t)) }
    )
  }

  return (
    <FormSheet visible={visible} title={product ? t('products.edit') : t('products.new')} onClose={onClose}>
      <TextField value={name} onChangeText={setName} placeholder={t('products.name')} />
      <AppText variant="muted">{t('products.unit')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {UNITS.map((u) => {
          const active = unit === u
          return (
            <Pressable
              key={u}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setUnit(u)}
              style={{
                minHeight: 44,
                minWidth: 64,
                paddingHorizontal: spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.accent : colors.card
              }}
            >
              <Text style={{ color: active ? colors.accentForeground : colors.foreground, fontWeight: active ? '700' : '500' }}>{t(`unit.${u}` as 'unit.piece')}</Text>
            </Pressable>
          )
        })}
      </View>
      <TextField value={barcode} onChangeText={setBarcode} placeholder={t('products.barcode')} keyboardType="numeric" />
      <TextField value={category} onChangeText={setCategory} placeholder={t('products.category')} />
      {!product && <TextField value={price} onChangeText={setPrice} placeholder={t('products.initialPrice')} keyboardType="decimal-pad" />}
      {error ? <AppText variant="caption" style={{ color: colors.destructive }}>{error}</AppText> : null}
      <AppButton label={product ? t('invoice.save') : t('products.create')} onPress={() => save()} loading={busy} />
    </FormSheet>
  )
}
