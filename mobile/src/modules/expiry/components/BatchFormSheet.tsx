import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import type { ExpirationBatch, Product } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, TextField } from '@/shared/components/ui'
import { DateField } from '@/shared/components/DateField'
import { FormSheet } from '@/shared/components/FormSheet'
import { useI18n } from '@/shared/i18n/useI18n'
import { parseISODate } from '@/shared/lib/dates'
import { errorText } from '@/shared/lib/errorMessage'
import { parseNumber } from '@/shared/lib/numbers'
import { toast } from '@/shared/lib/toast'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { useExpiryMutations } from '../hooks/useExpiry'
import { ProductPicker } from './ProductPicker'

type Errors = Partial<Record<'product' | 'batch' | 'expiry' | 'order' | 'qty', string>>

/** Add a batch (pick the product first) or edit one (the product of a batch can never change). */
export function BatchFormSheet({ visible, onClose, batch }: { visible: boolean; onClose: () => void; batch?: ExpirationBatch }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const m = useExpiryMutations()
  const [product, setProduct] = useState<Product | null>(null)
  const [batchNumber, setBatchNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [mfg, setMfg] = useState('')
  const [qty, setQty] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const key = useRef(newIdempotencyKey())

  useEffect(() => {
    if (!visible) return
    setProduct(
      batch
        ? ({ id: batch.product_id, name: batch.product_name, barcode: batch.product_barcode, category: batch.product_category, unit: batch.product_unit } as Product)
        : null
    )
    setBatchNumber(batch?.batch_number ?? '')
    setExpiry(batch?.expiration_date ?? '')
    setMfg(batch?.manufacturing_date ?? '')
    setQty(batch?.quantity != null ? String(batch.quantity) : '')
    setLocation(batch?.location ?? '')
    setNotes(batch?.notes ?? '')
    setErrors({})
    setServerError(null)
    key.current = newIdempotencyKey() // one key per opening: a retry of the same save replays, never duplicates
  }, [visible, batch])

  const busy = m.create.isPending || m.update.isPending
  const quick = [
    { label: t('expiry.quick.1m'), months: 1 },
    { label: t('expiry.quick.3m'), months: 3 },
    { label: t('expiry.quick.6m'), months: 6 },
    { label: t('expiry.quick.1y'), months: 12 }
  ]

  function save() {
    const next: Errors = {}
    if (!product) next.product = t('expiry.err.product')
    if (!batchNumber.trim()) next.batch = t('expiry.err.batch')
    if (!expiry) next.expiry = t('expiry.err.expiry')
    const quantity = qty.trim() === '' ? undefined : parseNumber(qty)
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0)) next.qty = t('expiry.err.qty')
    const e = parseISODate(expiry)
    const mf = parseISODate(mfg)
    if (e && mf && e < mf) next.order = t('expiry.err.order')
    setErrors(next)
    if (Object.keys(next).length > 0 || !product) return

    const onError = (err: Error) => setServerError(errorText(err, t))
    const done = () => { toast(t('money.done')); onClose() }

    if (batch) {
      m.update.mutate(
        {
          id: batch.id,
          key: key.current,
          data: {
            batchNumber: batchNumber.trim(),
            expirationDate: expiry,
            manufacturingDate: mfg, // '' clears it
            quantity: (quantity ?? null) as number | undefined,
            location: location.trim(),
            notes: notes.trim()
          }
        },
        { onSuccess: done, onError }
      )
    } else {
      m.create.mutate(
        {
          key: key.current,
          data: {
            productId: product.id,
            batchNumber: batchNumber.trim(),
            expirationDate: expiry,
            ...(mfg ? { manufacturingDate: mfg } : {}),
            ...(quantity !== undefined ? { quantity } : {}),
            ...(location.trim() ? { location: location.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {})
          }
        },
        { onSuccess: done, onError }
      )
    }
  }

  return (
    <FormSheet visible={visible} title={batch ? t('expiry.edit') : t('expiry.add')} onClose={onClose}>
      <ProductPicker value={product} onChange={setProduct} disabled={!!batch} error={errors.product} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="muted">{t('expiry.field.batch')}</AppText>
        <TextField value={batchNumber} onChangeText={setBatchNumber} placeholder={t('expiry.field.batch')} />
        {errors.batch ? <AppText variant="caption" style={{ color: colors.destructive }}>{errors.batch}</AppText> : null}
      </View>
      <DateField
        label={t('expiry.field.expiry')}
        value={expiry}
        onChange={setExpiry}
        placeholder={t('expiry.pickDate')}
        quickPicks={quick}
        error={errors.expiry ?? errors.order}
      />
      <DateField label={t('expiry.field.mfg')} value={mfg} onChange={setMfg} placeholder={t('expiry.pickDate')} clearable clearLabel={t('expiry.clearDate')} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="muted">{t('expiry.field.qty')}</AppText>
        <TextField value={qty} onChangeText={setQty} placeholder={t('expiry.field.qty')} keyboardType="decimal-pad" />
        {errors.qty ? <AppText variant="caption" style={{ color: colors.destructive }}>{errors.qty}</AppText> : null}
      </View>
      <TextField value={location} onChangeText={setLocation} placeholder={t('expiry.field.location')} />
      <TextField value={notes} onChangeText={setNotes} placeholder={t('expiry.field.notes')} />
      {serverError ? <AppText variant="caption" style={{ color: colors.destructive }}>{serverError}</AppText> : null}
      <AppButton label={batch ? t('invoice.save') : t('expiry.add')} onPress={save} loading={busy} />
    </FormSheet>
  )
}
