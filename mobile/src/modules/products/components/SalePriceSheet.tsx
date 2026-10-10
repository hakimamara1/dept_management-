import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import type { Product } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { parseNumber } from '@/shared/lib/numbers'
import { toast } from '@/shared/lib/toast'
import { useTheme } from '@/shared/theme/useTheme'
import { useProductMutations } from '../hooks/useProducts'
import { marginPercent, unitCost } from '../lib/metrics'

/** Change the default sale price. Shows the resulting margin first and says so plainly when it would sell at a loss. */
export function SalePriceSheet({ visible, onClose, product }: { visible: boolean; onClose: () => void; product: Product }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const m = useProductMutations()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = useRef(newIdempotencyKey())

  useEffect(() => {
    if (!visible) return
    setText(product.default_sale_price != null ? String(product.default_sale_price) : '')
    setError(null)
    key.current = newIdempotencyKey()
  }, [visible, product.default_sale_price])

  const value = parseNumber(text)
  const valid = Number.isFinite(value) && value >= 0
  const cost = unitCost(product)
  const resulting = valid ? marginPercent(value, cost) : null
  const loss = valid && cost != null && value < cost

  function save() {
    if (!valid) return setError(t('products.invalidPrice'))
    m.setSalePrice.mutate(
      { id: product.id, price: value, key: key.current },
      { onSuccess: () => { toast(t('money.done')); onClose() }, onError: (e) => setError(errorText(e, t)) }
    )
  }

  return (
    <FormSheet visible={visible} title={`${t('products.editPrice')} — ${product.name}`} onClose={onClose}>
      <Card>
        <Row label={t('products.currentPrice')} value={product.default_sale_price != null ? formatCurrency(product.default_sale_price) : t('products.notSet')} />
        <Row label={t('products.avgCost')} value={cost != null ? formatCurrency(cost) : '—'} />
      </Card>
      <TextField value={text} onChangeText={setText} placeholder={t('products.newPrice')} keyboardType="decimal-pad" />
      {valid && (
        <Row
          label={t('products.resultingMargin')}
          value={formatPercent(resulting)}
          color={loss ? colors.destructive : colors.foreground}
        />
      )}
      {loss ? <AppText variant="caption" style={{ color: colors.destructive }}>{t('products.belowCost')}</AppText> : null}
      {error ? <AppText variant="caption" style={{ color: colors.destructive }}>{error}</AppText> : null}
      <AppButton label={t('invoice.save')} onPress={save} loading={m.setSalePrice.isPending} disabled={!valid} />
    </FormSheet>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <AppText variant="muted">{label}</AppText>
      <AppText variant="body" style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color }}>{value}</AppText>
    </View>
  )
}
