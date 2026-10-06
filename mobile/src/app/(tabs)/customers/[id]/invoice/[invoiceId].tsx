import { useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { SalesInvoiceItem } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card, ListRow, Screen, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import { useTheme } from '@/shared/theme/useTheme'
import { ItemForm } from '@/modules/customers/components/ItemForm'
import { useCustomerInvoice, useInvoiceMutations } from '@/modules/customers/hooks/useSalesInvoices'

/** Draft: fully editable, no effect on the balance until approved. Approved: read-only. */
export default function InvoiceEditorScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const { id, invoiceId } = useLocalSearchParams<{ id: string; invoiceId: string }>()
  const customerId = Number(id)
  const salesInvoiceId = Number(invoiceId)
  const query = useCustomerInvoice(customerId, salesInvoiceId)
  const m = useInvoiceMutations(customerId, salesInvoiceId)
  const [editing, setEditing] = useState<SalesInvoiceItem | 'new' | null>(null)
  const [notes, setNotes] = useState('')
  const approveKey = useRef(newIdempotencyKey())
  const data = query.data

  useEffect(() => { if (data) setNotes(data.notes ?? '') }, [data?.notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: Error) => Alert.alert(e.message)
  const isDraft = data?.status === 'Draft'

  function approve() {
    Alert.alert(t('invoice.approve'), t('invoice.approveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('invoice.approve'), onPress: () => m.approve.mutate(approveKey.current, { onSuccess: () => toast(t('money.done')), onError: fail }) }
    ])
  }

  function deleteDraft() {
    Alert.alert(t('invoice.deleteDraft'), t('invoice.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('invoice.deleteDraft'), style: 'destructive', onPress: () => m.deleteInvoice.mutate(undefined, { onSuccess: () => router.back(), onError: fail }) }
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: data?.invoice_number ?? t('invoice.invoices') }} />
      <QueryBoundary query={query}>
        {(inv) => (
          <>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="heading">{inv.customer_name}</AppText>
                <AppText style={{ color: isDraft ? colors.warning : colors.success, fontWeight: '700' }}>
                  {isDraft ? t('invoice.draft') : t('invoice.final')}
                </AppText>
              </View>
              <AppText variant="muted">{formatDate(inv.invoice_date)}</AppText>
            </Card>

            <View style={{ marginHorizontal: -16 }}>
              {inv.items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.product_name}
                  subtitle={`${item.quantity} ${item.unit ?? ''} × ${formatCurrency(item.unit_price)}`}
                  trailing={formatCurrency(item.line_total)}
                  onPress={isDraft ? () => setEditing(item) : undefined}
                />
              ))}
            </View>

            {isDraft && <AppButton variant="outline" label={t('invoice.addItem')} onPress={() => setEditing('new')} />}

            {isDraft ? (
              <>
                <AppText variant="muted">{t('invoice.notes')}</AppText>
                <TextField
                  value={notes}
                  onChangeText={setNotes}
                  onBlur={() => { if (notes !== (inv.notes ?? '')) m.updateNotes.mutate(notes, { onError: fail }) }}
                />
              </>
            ) : inv.notes ? (
              <AppText variant="muted">{inv.notes}</AppText>
            ) : null}

            <Card>
              <Row label={isDraft ? t('invoice.previousBalance') : t('suppliers.balance')} value={formatCurrency(inv.previous_balance)} />
              <Row label={t('invoice.amount')} value={formatCurrency(inv.invoice_amount)} />
              <Row label={isDraft ? t('invoice.newBalance') : t('money.newBalance')} value={formatCurrency(inv.new_balance)} bold />
            </Card>

            {isDraft && (
              <View style={{ gap: 8 }}>
                <AppButton label={t('invoice.approve')} onPress={approve} loading={m.approve.isPending} />
                <AppButton variant="destructive" label={t('invoice.deleteDraft')} onPress={deleteDraft} loading={m.deleteInvoice.isPending} />
              </View>
            )}

            <FormSheet visible={editing != null} title={editing === 'new' ? t('invoice.addItem') : editing?.product_name ?? ''} onClose={() => setEditing(null)}>
              {editing === 'new' && (
                <ItemForm
                  submitLabel={t('invoice.addItem')}
                  loading={m.addItem.isPending}
                  onSubmit={(v) => m.addItem.mutate({ productName: v.productName, unit: v.unit || undefined, quantity: v.quantity, unitPrice: v.unitPrice }, { onSuccess: () => setEditing(null), onError: fail })}
                />
              )}
              {editing && editing !== 'new' && (
                <>
                  <ItemForm
                    initial={{ productName: editing.product_name, unit: editing.unit ?? '', quantity: editing.quantity, unitPrice: editing.unit_price }}
                    submitLabel={t('invoice.save')}
                    loading={m.updateItem.isPending}
                    onSubmit={(v) => m.updateItem.mutate({ itemId: editing.id, data: { productName: v.productName, unit: v.unit || null, quantity: v.quantity, unitPrice: v.unitPrice } }, { onSuccess: () => setEditing(null), onError: fail })}
                  />
                  <AppButton
                    variant="destructive"
                    label={t('invoice.deleteItem')}
                    loading={m.deleteItem.isPending}
                    onPress={() => m.deleteItem.mutate(editing.id, { onSuccess: () => setEditing(null), onError: fail })}
                  />
                </>
              )}
            </FormSheet>
          </>
        )}
      </QueryBoundary>
    </Screen>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant={bold ? 'heading' : 'muted'}>{label}</AppText>
      <AppText variant={bold ? 'heading' : 'body'} style={{ fontVariant: ['tabular-nums'] }}>{value}</AppText>
    </View>
  )
}
