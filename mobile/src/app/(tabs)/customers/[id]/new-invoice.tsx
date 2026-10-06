import { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ApiError, newIdempotencyKey } from '@/shared/api/client'
import { AppText, Screen, TextField } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { todayISO } from '@/shared/lib/numbers'
import { ItemForm, type ItemValues } from '@/modules/customers/components/ItemForm'
import { useCreateSalesInvoice } from '@/modules/customers/hooks/useSalesInvoices'

/** Creates a Draft with its first line; more lines are added in the editor. A draft has no effect on the balance. */
export default function NewInvoiceScreen() {
  const { t } = useI18n()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const customerId = Number(id)
  const create = useCreateSalesInvoice(customerId)
  const [date, setDate] = useState(todayISO())
  const key = useRef(newIdempotencyKey())

  function submit(item: ItemValues) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      Alert.alert(t('invoice.dateError'))
      return
    }
    create.mutate(
      { key: key.current, data: { invoiceDate: date, items: [{ productName: item.productName, unit: item.unit || undefined, quantity: item.quantity, unitPrice: item.unitPrice }] } },
      {
        onSuccess: (invoice) => router.replace(`/customers/${customerId}/invoice/${invoice.id}`),
        onError: (e) => {
          // A definitive rejection means nothing was created: use a fresh key next time. After a network
          // failure keep the key so a retry replays instead of creating a second draft.
          if (e instanceof ApiError && e.code === 'HTTP') key.current = newIdempotencyKey()
          Alert.alert(e.message)
        }
      }
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('invoice.newInvoice') }} />
      <AppText variant="muted">{t('invoice.date')}</AppText>
      <TextField value={date} onChangeText={setDate} />
      <AppText variant="heading">{t('invoice.firstItem')}</AppText>
      <ItemForm submitLabel={t('invoice.createDraft')} loading={create.isPending} onSubmit={submit} />
    </Screen>
  )
}
