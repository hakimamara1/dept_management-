import { useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { InvoiceReviewItem } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card, ListRow, Screen, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import { useTheme } from '@/shared/theme/useTheme'
import { ItemForm } from '@/modules/customers/components/ItemForm'
import { SupplierSheet } from '@/modules/invoices/components/SupplierSheet'
import { useInvoiceReview, useReviewMutations } from '@/modules/invoices/hooks/useInvoices'

/** Pending Review: fix lines, match every line to a product, pick the supplier, then approve. */
export default function InvoiceReviewScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const invoiceId = Number(id)
  const query = useInvoiceReview(invoiceId)
  const m = useReviewMutations(invoiceId)
  const [editing, setEditing] = useState<InvoiceReviewItem | 'new' | null>(null)
  const [pickSupplier, setPickSupplier] = useState(false)
  const [notes, setNotes] = useState('')
  const approveKey = useRef(newIdempotencyKey())
  const data = query.data
  const pendingReview = data?.invoice.status === 'Pending Review'

  useEffect(() => { if (data) setNotes(data.invoice.notes ?? '') }, [data?.invoice.notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: Error) => Alert.alert(e.message)

  function approve() {
    Alert.alert(t('scan.approve'), t('scan.approveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('scan.approve'), onPress: () => m.approve.mutate(approveKey.current, { onSuccess: () => { toast(t('money.done')); router.back() }, onError: fail }) }
    ])
  }

  function deleteInvoice() {
    Alert.alert(t('scan.delete'), t('scan.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('scan.delete'), style: 'destructive', onPress: () => m.deleteInvoice.mutate(undefined, { onSuccess: () => router.back(), onError: fail }) }
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: data?.invoice.invoice_number ?? t('tabs.invoices') }} />
      <QueryBoundary query={query}>
        {({ invoice, items }) => {
          const unmatched = items.filter((i) => !i.product_id)
          const blockers = [
            !invoice.supplier_id ? t('scan.needSupplier') : null,
            items.length === 0 ? t('scan.needItems') : null,
            unmatched.length > 0 ? `${unmatched.length} ${t('scan.unmatched')}` : null
          ].filter(Boolean) as string[]
          const ocrDiff = invoice.ocr_header_total != null ? invoice.invoice_amount - invoice.ocr_header_total : 0

          return (
            <>
              <Card>
                <AppText variant="caption">{t('scan.supplier')}</AppText>
                <AppText variant="heading" style={{ color: invoice.supplier_id ? colors.foreground : colors.destructive }}>
                  {invoice.supplier_name ?? t('scan.chooseSupplier')}
                </AppText>
                {invoice.ocr_supplier_name && !invoice.supplier_id ? (
                  <AppText variant="caption">{t('scan.aiRead')}: {invoice.ocr_supplier_name}</AppText>
                ) : null}
                <AppText variant="muted">{formatDate(invoice.invoice_date)}</AppText>
                {pendingReview && <AppButton variant="outline" label={t('scan.chooseSupplier')} onPress={() => setPickSupplier(true)} />}
              </Card>

              <View style={{ marginHorizontal: -16 }}>
                {items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.ocr_product_name}
                    subtitle={`${item.quantity} ${item.unit ?? ''} × ${formatCurrency(item.unit_price)} · ${item.product_id ? (item.matched_product_name ?? t('scan.matched')) : t('scan.notMatched')}`}
                    trailing={formatCurrency(item.total_price)}
                    trailingColor={item.product_id ? colors.foreground : colors.warning}
                    onPress={pendingReview ? () => setEditing(item) : undefined}
                  />
                ))}
              </View>
              {pendingReview && <AppButton variant="outline" label={t('invoice.addItem')} onPress={() => setEditing('new')} />}

              {pendingReview && (
                <>
                  <AppText variant="muted">{t('invoice.notes')}</AppText>
                  <TextField value={notes} onChangeText={setNotes} onBlur={() => { if (notes !== (invoice.notes ?? '')) m.updateNotes.mutate(notes, { onError: fail }) }} />
                </>
              )}

              <Card>
                <Row label={t('invoice.amount')} value={formatCurrency(invoice.invoice_amount)} bold />
                {invoice.ocr_header_total != null && Math.abs(ocrDiff) > 0.01 && (
                  <AppText variant="caption" style={{ color: colors.warning }}>
                    {t('scan.ocrDiff')}: {formatCurrency(invoice.ocr_header_total)} ({ocrDiff > 0 ? '+' : ''}{formatCurrency(ocrDiff)})
                  </AppText>
                )}
              </Card>

              {pendingReview && (
                <View style={{ gap: 8 }}>
                  {blockers.map((b) => (
                    <AppText key={b} variant="caption" style={{ color: colors.warning }}>• {b}</AppText>
                  ))}
                  <AppButton label={t('scan.approve')} onPress={approve} disabled={blockers.length > 0} loading={m.approve.isPending} />
                  <AppButton variant="destructive" label={t('scan.delete')} onPress={deleteInvoice} loading={m.deleteInvoice.isPending} />
                </View>
              )}

              <SupplierSheet visible={pickSupplier} onClose={() => setPickSupplier(false)} onPick={(sid) => m.updateSupplier.mutate(sid, { onError: fail })} />

              <FormSheet visible={editing != null} title={editing === 'new' ? t('invoice.addItem') : editing?.ocr_product_name ?? ''} onClose={() => setEditing(null)}>
                {editing === 'new' && (
                  <ItemForm
                    prefillSalePrice={false}
                    submitLabel={t('invoice.addItem')}
                    loading={m.addItem.isPending}
                    onSubmit={(v) => m.addItem.mutate({ productName: v.productName, unit: v.unit || undefined, quantity: v.quantity, unitPrice: v.unitPrice, productId: v.productId }, { onSuccess: () => setEditing(null), onError: fail })}
                  />
                )}
                {editing && editing !== 'new' && (
                  <>
                    {!editing.product_id && editing.suggested_product_id != null && (
                      <AppButton
                        variant="outline"
                        label={`${t('scan.acceptSuggestion')}: ${editing.suggested_product_name}`}
                        onPress={() => m.updateItem.mutate({ itemId: editing.id, data: { productId: editing.suggested_product_id! } }, { onSuccess: () => setEditing(null), onError: fail })}
                      />
                    )}
                    {!editing.product_id && (
                      <AppButton
                        variant="outline"
                        label={t('scan.createProduct')}
                        onPress={() => m.updateItem.mutate({ itemId: editing.id, data: { createNewProduct: { unit: editing.unit || 'piece' } } }, { onSuccess: () => setEditing(null), onError: fail })}
                      />
                    )}
                    <ItemForm
                      prefillSalePrice={false}
                      initial={{ productName: editing.ocr_product_name, unit: editing.unit ?? '', quantity: editing.quantity, unitPrice: editing.unit_price }}
                      submitLabel={t('invoice.save')}
                      loading={m.updateItem.isPending}
                      onSubmit={(v) => m.updateItem.mutate({ itemId: editing.id, data: { productName: v.productName, unit: v.unit || undefined, quantity: v.quantity, unitPrice: v.unitPrice, productId: v.productId } }, { onSuccess: () => setEditing(null), onError: fail })}
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
          )
        }}
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
