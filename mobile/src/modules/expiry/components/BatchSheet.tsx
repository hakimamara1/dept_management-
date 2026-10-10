import { useState } from 'react'
import { Alert, View } from 'react-native'
import type { ExpirationBatch } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card } from '@/shared/components/ui'
import { Badge } from '@/shared/components/Badge'
import { FormSheet } from '@/shared/components/FormSheet'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatDate } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import { spacing } from '@/shared/theme/useTheme'
import { useExpiryMutations } from '../hooks/useExpiry'
import { daysLabel } from '../lib/format'
import { bucketOf, daysLeft } from '../lib/urgency'
import { BatchFormSheet } from './BatchFormSheet'

/** Details of one batch and what can be done with it: edit, mark sold, discard, reopen, delete. */
export function BatchSheet({ batch, onClose }: { batch: ExpirationBatch | null; onClose: () => void }) {
  const { t } = useI18n()
  const m = useExpiryMutations()
  const [editing, setEditing] = useState(false)
  if (!batch) return null
  const closed = bucketOf(batch) === 'closed'
  const fail = (e: Error) => Alert.alert(errorText(e, t))
  const done = () => { toast(t('money.done')); onClose() }
  const status = (s: 'ACTIVE' | 'SOLD' | 'DISCARDED') => m.setStatus.mutate({ id: batch.id, status: s, key: newIdempotencyKey() }, { onSuccess: done, onError: fail })

  function remove() {
    Alert.alert(t('expiry.action.delete'), t('expiry.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('expiry.action.delete'), style: 'destructive', onPress: () => m.remove.mutate({ id: batch!.id, key: newIdempotencyKey() }, { onSuccess: done, onError: fail }) }
    ])
  }

  const rows: [string, string | null][] = [
    [t('expiry.field.batch'), batch.batch_number],
    [t('expiry.field.expiry'), formatDate(batch.expiration_date)],
    [t('expiry.field.mfg').replace(/\s*\(.*\)$/, ''), batch.manufacturing_date ? formatDate(batch.manufacturing_date) : null],
    [t('expiry.field.qty').replace(/\s*\(.*\)$/, ''), batch.quantity != null ? `${batch.quantity}${batch.unit ? ` ${batch.unit}` : ''}` : null],
    [t('expiry.field.location').replace(/\s*\(.*\)$/, ''), batch.location],
    [t('expiry.field.notes').replace(/\s*\(.*\)$/, ''), batch.notes]
  ]

  return (
    <>
      <FormSheet visible={!editing} title={batch.product_name} onClose={onClose}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {closed ? (
            <Badge label={batch.computed_status === 'SOLD' ? t('expiry.status.sold') : t('expiry.status.discarded')} />
          ) : (
            <AppText variant="heading">{daysLabel(daysLeft(batch.expiration_date), t)}</AppText>
          )}
        </View>
        <Card>
          {rows.filter(([, v]) => v).map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <AppText variant="muted">{label}</AppText>
              <AppText variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
            </View>
          ))}
        </Card>
        {closed ? (
          <AppButton label={t('expiry.action.reopen')} onPress={() => status('ACTIVE')} loading={m.setStatus.isPending} />
        ) : (
          <>
            <AppButton label={t('expiry.action.sold')} onPress={() => status('SOLD')} loading={m.setStatus.isPending} />
            <AppButton variant="outline" label={t('expiry.action.discard')} onPress={() => status('DISCARDED')} />
          </>
        )}
        <AppButton variant="outline" label={t('expiry.edit')} onPress={() => setEditing(true)} />
        <AppButton variant="destructive" label={t('expiry.action.delete')} onPress={remove} loading={m.remove.isPending} />
      </FormSheet>
      <BatchFormSheet visible={editing} batch={batch} onClose={() => { setEditing(false); onClose() }} />
    </>
  )
}
