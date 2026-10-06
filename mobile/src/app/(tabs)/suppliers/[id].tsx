import { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { AppButton, AppText, Card, ListRow, Screen } from '@/shared/components/ui'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { useTheme } from '@/shared/theme/useTheme'
import { MoneyActionSheet } from '@/modules/payments/components/MoneyActionSheet'
import { useSupplier, useSupplierLedger } from '@/modules/suppliers/hooks/useSuppliers'

export default function SupplierDetailScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const supplierId = Number(id)
  const supplier = useSupplier(supplierId)
  const ledger = useSupplierLedger(supplierId)
  const [sheet, setSheet] = useState<'payment' | 'adjust' | null>(null)
  const typeLabel = { invoice: t('debt.type.invoice'), payment: t('debt.type.payment'), adjustment: t('debt.type.adjustment') }

  return (
    <Screen>
      <Stack.Screen options={{ title: supplier.data?.name ?? t('tabs.suppliers') }} />
      <QueryBoundary query={supplier}>
        {(s) => (
          <>
          <Card>
            <AppText variant="caption">{t('suppliers.balance')}</AppText>
            <AppText variant="title" style={{ color: s.current_balance > 0 ? colors.destructive : colors.foreground }}>
              {formatCurrency(s.current_balance)}
            </AppText>
            {[s.phone, s.email, s.address].filter(Boolean).map((line) => (
              <AppText key={line} variant="muted">{line}</AppText>
            ))}
          </Card>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><AppButton label={t('money.recordPayment')} onPress={() => setSheet('payment')} disabled={s.current_balance <= 0} /></View>
            <View style={{ flex: 1 }}><AppButton variant="outline" label={t('money.adjustBalance')} onPress={() => setSheet('adjust')} /></View>
          </View>
          {sheet && (
            <MoneyActionSheet
              visible
              onClose={() => setSheet(null)}
              party="supplier"
              action={sheet}
              partyId={supplierId}
              partyName={s.name}
              currentBalance={s.current_balance}
            />
          )}
          </>
        )}
      </QueryBoundary>

      <AppText variant="heading">{t('suppliers.ledger')}</AppText>
      <QueryBoundary query={ledger}>
        {(rows) => (
          <View style={{ marginHorizontal: -16, borderTopWidth: 0 }}>
            {rows.length === 0 ? <AppText variant="muted" style={{ padding: 16 }}>{t('common.noResults')}</AppText> : null}
            {rows.map((r) => (
              <ListRow
                key={r.id}
                title={`${typeLabel[r.transaction_type]}${r.invoice_number ? ` · #${r.invoice_number}` : ''}`}
                subtitle={`${formatDate(r.created_at)} · ${t('suppliers.balanceAfter')} ${formatCurrency(r.balance_after)}`}
                trailing={`${r.amount > 0 ? '+' : ''}${formatCurrency(r.amount)}`}
                trailingColor={r.amount > 0 ? colors.destructive : colors.success}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  )
}
