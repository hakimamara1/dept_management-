import { useState } from 'react'
import { View } from 'react-native'
import { AppButton, AppText, TextField } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { parseNumber } from '@/shared/lib/numbers'
import { useTheme } from '@/shared/theme/useTheme'
import { ProductSearchField } from './ProductSearchField'

export interface ItemValues {
  productName: string
  unit: string
  quantity: number
  unitPrice: number
  /** Set when the user picked a catalogue suggestion (used by purchase review to match the line). */
  productId?: number
}

/** One invoice line: name (with catalogue suggestions), unit, quantity, price. Validates like the server does. */
export function ItemForm({ initial, submitLabel, loading, onSubmit, prefillSalePrice = true }: { initial?: ItemValues; submitLabel: string; loading?: boolean; onSubmit: (v: ItemValues) => void; prefillSalePrice?: boolean }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const [name, setName] = useState(initial?.productName ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [qty, setQty] = useState(initial ? String(initial.quantity) : '')
  const [price, setPrice] = useState(initial ? String(initial.unitPrice) : '')
  const [error, setError] = useState<string | null>(null)
  const [productId, setProductId] = useState<number | undefined>(undefined)

  function submit() {
    const quantity = parseNumber(qty)
    const unitPrice = parseNumber(price)
    if (!name.trim()) return setError(t('invoice.errorName'))
    if (!Number.isFinite(quantity) || quantity <= 0) return setError(t('invoice.errorQty'))
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return setError(t('invoice.errorPrice'))
    setError(null)
    onSubmit({ productName: name.trim(), unit: unit.trim(), quantity, unitPrice, productId })
  }

  return (
    <View style={{ gap: 12 }}>
      <ProductSearchField
        value={name}
        onChangeText={(v) => { setName(v); setProductId(undefined) }}
        onPick={(p) => {
          setName(p.name)
          setProductId(p.id)
          if (p.unit && !unit) setUnit(String(p.unit))
          if (prefillSalePrice && p.default_sale_price != null && !price) setPrice(String(p.default_sale_price))
        }}
      />
      <TextField value={unit} onChangeText={setUnit} placeholder={t('invoice.unit')} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><TextField value={qty} onChangeText={setQty} placeholder={t('invoice.quantity')} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><TextField value={price} onChangeText={setPrice} placeholder={t('invoice.unitPrice')} keyboardType="decimal-pad" /></View>
      </View>
      {error && <AppText style={{ color: colors.destructive }} accessibilityRole="alert">{error}</AppText>}
      <AppButton label={submitLabel} onPress={submit} loading={loading} />
    </View>
  )
}
