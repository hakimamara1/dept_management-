import { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { AppButton, AppText, Card, ListRow, Screen } from '@/shared/components/ui'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { useTheme } from '@/shared/theme/useTheme'
import { MoneyActionSheet } from '@/modules/payments/components/MoneyActionSheet'
import { useCustomer, useCustomerStatement } from '@/modules/customers/hooks/useCustomers'
import { useCustomerInvoices } from '@/modules/customers/hooks/useSalesInvoices'

export default function CustomerDetailScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const customerId = Number(id)
  const customer = useCustomer(customerId)
  const invoices = useCustomerInvoices(customerId)
  const statement = useCustomerStatement(customerId)
  const [sheet, setSheet] = useState<'payment' | 'adjust' | null>(null)
  const typeLabel = { invoice: t('debt.type.invoice'), payment: t('debt.type.payment'), adjustment: t('debt.type.adjustment') }

  return (
    <Screen>
      <Stack.Screen options={{ title: customer.data?.full_name ?? t('tabs.customers') }} />
      <QueryBoundary query={customer}>
        {(c) => (
          <>
            <Card>
              <AppText variant="caption">{t('suppliers.balance')}</AppText>
              <AppText variant="title" style={{ color: c.current_balance > 0 ? colors.destructive : colors.foreground }}>
                {formatCurrency(c.current_balance)}
              </AppText>
              {[c.phone, c.address].filter(Boolean).map((line) => (
                <AppText key={line} variant="muted">{line}</AppText>
              ))}
            </Card>
            <View style={{ gap: 8 }}>
              <AppButton label={t('invoice.newInvoice')} onPress={() => router.push(`/customers/${customerId}/new-invoice`)} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><AppButton variant="outline" label={t('money.recordPayment')} onPress={() => setSheet('payment')} /></View>
                <View style={{ flex: 1 }}><AppButton variant="outline" label={t('money.adjustBalance')} onPress={() => setSheet('adjust')} /></View>
              </View>
            </View>
            {sheet && (
              <MoneyActionSheet
                visible
                onClose={() => setSheet(null)}
                party="customer"
                action={sheet}
                partyId={customerId}
                partyName={c.full_name}
                currentBalance={c.current_balance}
              />
            )}
          </>
        )}
      </QueryBoundary>

      <AppText variant="heading">{t('invoice.invoices')}</AppText>
      <QueryBoundary query={invoices}>
        {(rows) => (
          <View style={{ marginHorizontal: -16 }}>
            {rows.length === 0 ? <AppText variant="muted" style={{ padding: 16 }}>{t('common.noResults')}</AppText> : null}
            {[...rows].sort((a, b) => Number(b.status === 'Draft') - Number(a.status === 'Draft') || b.id - a.id).map((inv) => (
              <ListRow
                key={inv.id}
                title={`${inv.invoice_number}${inv.status === 'Draft' ? ` · ${t('invoice.draft')}` : ''}`}
                subtitle={formatDate(inv.invoice_date)}
                trailing={formatCurrency(inv.invoice_amount)}
                trailingColor={inv.status === 'Draft' ? colors.warning : colors.foreground}
                onPress={() => router.push(`/customers/${customerId}/invoice/${inv.id}`)}
              />
            ))}
          </View>
        )}
      </QueryBoundary>

      <AppText variant="heading">{t('customers.statement')}</AppText>
      <QueryBoundary query={statement}>
        {(rows) => (
          <View style={{ marginHorizontal: -16 }}>
            {rows.length === 0 ? <AppText variant="muted" style={{ padding: 16 }}>{t('common.noResults')}</AppText> : null}
            {[...rows].reverse().map((r) => (
              <ListRow
                key={`${r.entry_type}-${r.entry_id}`}
                title={`${typeLabel[r.entry_type]}${r.reference ? ` · ${r.reference}` : ''}`}
                subtitle={`${formatDate(r.entry_date)} · ${t('suppliers.balanceAfter')} ${formatCurrency(r.balance)}`}
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
