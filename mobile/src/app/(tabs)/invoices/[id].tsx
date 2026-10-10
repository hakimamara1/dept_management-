import { useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { InvoiceReviewItem } from '@desktop-types/api'
import { newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card, ListRow, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { IconBubble } from '@/shared/components/Badge'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { ItemForm } from '@/modules/invoices/components/ItemForm'
import { SupplierSheet } from '@/modules/invoices/components/SupplierSheet'
import { useInvoiceReview, useReviewMutations } from '@/modules/invoices/hooks/useInvoices'
import { suggestSupplier } from '@/modules/invoices/lib/supplierMatch'
import { useSuppliers } from '@/modules/suppliers/hooks/useSuppliers'

/** One line of the readiness checklist: done / not done, with the reason in words (never colour alone). */
function Step({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 }}>
      <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? colors.success : colors.warning} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" style={{ fontWeight: '600' }}>{label}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
    </View>
  )
}

/**
 * Pending Review. The whole job on the phone: confirm the supplier, match every line, approve.
 * A checklist at the top says what is left; the approve bar at the bottom is always on screen.
 */
export default function InvoiceReviewScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const invoiceId = Number(id)
  const query = useInvoiceReview(invoiceId)
  const m = useReviewMutations(invoiceId)
  const suppliers = useSuppliers('')
  const [editing, setEditing] = useState<InvoiceReviewItem | 'new' | null>(null)
  const [pickSupplier, setPickSupplier] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [notes, setNotes] = useState('')
  const approveKey = useRef(newIdempotencyKey())
  const data = query.data
  const pendingReview = data?.invoice.status === 'Pending Review'

  useEffect(() => { if (data) setNotes(data.invoice.notes ?? '') }, [data?.invoice.notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: Error) => Alert.alert(errorText(e, t))

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

  /** Runs line updates one after another; stops at the first failure so the screen never ends half-explained. */
  async function bulk(work: InvoiceReviewItem[], data: (item: InvoiceReviewItem) => Parameters<typeof m.updateItem.mutateAsync>[0]['data']) {
    setBulkBusy(true)
    try {
      for (const item of work) await m.updateItem.mutateAsync({ itemId: item.id, data: data(item) })
    } catch (e) {
      fail(e as Error)
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
      <Stack.Screen options={{ title: data?.invoice.invoice_number ?? t('tabs.invoices') }} />
      <QueryBoundary query={query}>
        {({ invoice, items }) => {
          const unmatched = items.filter((i) => !i.product_id)
          const suggestible = unmatched.filter((i) => i.suggested_product_id != null)
          const needNew = unmatched.filter((i) => i.suggested_product_id == null)
          const suggestedSupplier = !invoice.supplier_id ? suggestSupplier(invoice.ocr_supplier_name, suppliers.data ?? []) : null
          const blockers = [
            !invoice.supplier_id ? t('scan.needSupplier') : null,
            items.length === 0 ? t('scan.needItems') : null,
            unmatched.length > 0 ? `${unmatched.length} ${t('scan.unmatched')}` : null
          ].filter(Boolean) as string[]
          const ready = blockers.length === 0
          const ocrDiff = invoice.ocr_header_total != null ? invoice.invoice_amount - invoice.ocr_header_total : 0

          return (
            <>
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
                {pendingReview && (
                  <Card>
                    <Step done={!!invoice.supplier_id} label={t('review.stepSupplier')} detail={invoice.supplier_name ?? undefined} />
                    <Step
                      done={unmatched.length === 0 && items.length > 0}
                      label={t('review.stepLines')}
                      detail={`${items.length - unmatched.length}/${items.length}`}
                    />
                    <Step done={ready} label={t('review.stepReady')} detail={ready ? t('review.done') : blockers[0]} />
                  </Card>
                )}

                <Card>
                  <AppText variant="caption">{t('scan.supplier')}</AppText>
                  <AppText variant="heading" style={{ color: invoice.supplier_id ? colors.foreground : colors.destructive }}>
                    {invoice.supplier_name ?? t('scan.chooseSupplier')}
                  </AppText>
                  {invoice.ocr_supplier_name && !invoice.supplier_id ? (
                    <AppText variant="caption">{t('scan.aiRead')}: {invoice.ocr_supplier_name}</AppText>
                  ) : null}
                  <AppText variant="muted">{formatDate(invoice.invoice_date)}</AppText>
                  {pendingReview && suggestedSupplier && (
                    <AppButton
                      label={`${t('review.useSupplier')}: ${suggestedSupplier.name}`}
                      loading={m.updateSupplier.isPending}
                      onPress={() => m.updateSupplier.mutate(suggestedSupplier.id, { onError: fail })}
                    />
                  )}
                  {pendingReview && (
                    <AppButton variant="outline" label={t('scan.chooseSupplier')} onPress={() => setPickSupplier(true)} />
                  )}
                </Card>

                {pendingReview && (suggestible.length > 0 || needNew.length > 0) && (
                  <View style={{ gap: spacing.sm }}>
                    {suggestible.length > 0 && (
                      <AppButton
                        variant="outline"
                        label={`${t('review.acceptAll')} (${suggestible.length})`}
                        loading={bulkBusy}
                        onPress={() => bulk(suggestible, (i) => ({ productId: i.suggested_product_id! }))}
                      />
                    )}
                    {needNew.length > 0 && (
                      <AppButton
                        variant="outline"
                        label={`${t('review.createAll')} (${needNew.length})`}
                        loading={bulkBusy}
                        onPress={() =>
                          Alert.alert(t('review.createAll'), t('review.createAllConfirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('review.createAll'), onPress: () => bulk(needNew, (i) => ({ createNewProduct: { unit: i.unit || 'piece' } })) }
                          ])
                        }
                      />
                    )}
                  </View>
                )}

                <View style={{ marginHorizontal: -spacing.lg }}>
                  {items.map((item) => {
                    const matched = !!item.product_id
                    return (
                      <ListRow
                        key={item.id}
                        leading={
                          <IconBubble tone={matched ? 'primary' : 'neutral'}>
                            <Ionicons name={matched ? 'checkmark' : 'alert'} size={20} color={matched ? colors.success : colors.warning} />
                          </IconBubble>
                        }
                        title={item.ocr_product_name}
                        subtitle={`${item.quantity} ${item.unit ?? ''} × ${formatCurrency(item.unit_price)} · ${
                          matched
                            ? item.matched_product_name ?? t('scan.matched')
                            : item.suggested_product_name
                              ? `${t('scan.notMatched')} → ${item.suggested_product_name}`
                              : t('scan.notMatched')
                        }`}
                        trailing={formatCurrency(item.total_price)}
                        trailingColor={matched ? colors.foreground : colors.warning}
                        onPress={pendingReview ? () => setEditing(item) : undefined}
                      />
                    )
                  })}
                </View>
                {pendingReview && <AppButton variant="outline" label={t('invoice.addItem')} onPress={() => setEditing('new')} />}

                {pendingReview && (
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="muted">{t('invoice.notes')}</AppText>
                    <TextField value={notes} onChangeText={setNotes} onBlur={() => { if (notes !== (invoice.notes ?? '')) m.updateNotes.mutate(notes, { onError: fail }) }} />
                  </View>
                )}

                {invoice.ocr_header_total != null && Math.abs(ocrDiff) > 0.01 && (
                  <AppText variant="caption" style={{ color: colors.warning }}>
                    {t('scan.ocrDiff')}: {formatCurrency(invoice.ocr_header_total)} ({ocrDiff > 0 ? '+' : ''}{formatCurrency(ocrDiff)})
                  </AppText>
                )}

                {pendingReview && (
                  <AppButton variant="destructive" label={t('scan.delete')} onPress={deleteInvoice} loading={m.deleteInvoice.isPending} />
                )}
              </ScrollView>

              {pendingReview && (
                <View
                  style={{
                    padding: spacing.lg,
                    gap: spacing.sm,
                    backgroundColor: colors.card,
                    borderTopWidth: 1,
                    borderTopColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText variant="muted">{t('review.total')}</AppText>
                    <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(invoice.invoice_amount)}</AppText>
                  </View>
                  {!ready && <AppText variant="caption" style={{ color: colors.warning }}>• {blockers.join(' · ')}</AppText>}
                  <AppButton label={t('scan.approve')} onPress={approve} disabled={!ready || bulkBusy} loading={m.approve.isPending} />
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
    </SafeAreaView>
  )
}

