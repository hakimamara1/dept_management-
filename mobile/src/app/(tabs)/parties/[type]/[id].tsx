import { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { AppButton, AppText, Card, ListRow, Screen } from '@/shared/components/ui'
import { Badge } from '@/shared/components/Badge'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { useTheme } from '@/shared/theme/useTheme'
import { MoneyActionSheet } from '@/modules/payments/components/MoneyActionSheet'
import { useCustomer, useCustomerStatement } from '@/modules/customers/hooks/useCustomers'
import { useSupplier, useSupplierLedger } from '@/modules/suppliers/hooks/useSuppliers'
import type { PartyType } from '@/modules/parties/lib/parties'

interface LedgerLine {
  key: string
  title: string
  subtitle: string
  amount: number
}

/** One account: balance, the single money action (payment / collection), and its ledger. No invoices here. */
export default function PartyDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>()
  const partyId = Number(id)
  return type === 'customer' ? <CustomerAccount id={partyId} /> : <SupplierAccount id={partyId} />
}

function SupplierAccount({ id }: { id: number }) {
  const { t } = useI18n()
  const supplier = useSupplier(id)
  const ledger = useSupplierLedger(id)
  const typeLabel = { invoice: t('debt.type.invoice'), payment: t('debt.type.payment'), adjustment: t('debt.type.adjustment') }
  const lines: LedgerLine[] | undefined = ledger.data?.map((r) => ({
    key: String(r.id),
    title: `${typeLabel[r.transaction_type]}${r.invoice_number ? ` · #${r.invoice_number}` : ''}`,
    subtitle: `${formatDate(r.created_at)} · ${t('suppliers.balanceAfter')} ${formatCurrency(r.balance_after)}`,
    amount: r.amount
  }))
  return (
    <AccountView
      type="supplier"
      partyId={id}
      name={supplier.data?.name}
      balance={supplier.data?.current_balance}
      contacts={[supplier.data?.phone, supplier.data?.email, supplier.data?.address]}
      detailQuery={supplier}
      ledgerQuery={ledger}
      lines={lines}
      canRecord={(supplier.data?.current_balance ?? 0) > 0}
    />
  )
}

function CustomerAccount({ id }: { id: number }) {
  const { t } = useI18n()
  const customer = useCustomer(id)
  const statement = useCustomerStatement(id)
  const typeLabel = { invoice: t('debt.type.invoice'), payment: t('debt.type.payment'), adjustment: t('debt.type.adjustment') }
  const lines: LedgerLine[] | undefined = statement.data
    ? [...statement.data].reverse().map((r) => ({
        key: `${r.entry_type}-${r.entry_id}`,
        title: `${typeLabel[r.entry_type]}${r.reference ? ` · ${r.reference}` : ''}`,
        subtitle: `${formatDate(r.entry_date)} · ${t('suppliers.balanceAfter')} ${formatCurrency(r.balance)}`,
        amount: r.amount
      }))
    : undefined
  return (
    <AccountView
      type="customer"
      partyId={id}
      name={customer.data?.full_name}
      balance={customer.data?.current_balance}
      contacts={[customer.data?.phone, customer.data?.address]}
      detailQuery={customer}
      ledgerQuery={statement}
      lines={lines}
      canRecord
    />
  )
}

function AccountView({
  type,
  partyId,
  name,
  balance,
  contacts,
  detailQuery,
  ledgerQuery,
  lines,
  canRecord
}: {
  type: PartyType
  partyId: number
  name?: string
  balance?: number
  contacts: (string | null | undefined)[]
  detailQuery: Parameters<typeof QueryBoundary>[0]['query']
  ledgerQuery: Parameters<typeof QueryBoundary>[0]['query']
  lines?: LedgerLine[]
  canRecord: boolean
}) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const [sheet, setSheet] = useState(false)
  const owed = (balance ?? 0) > 0
  const owedColor = type === 'supplier' ? colors.destructive : colors.warning

  return (
    <Screen>
      <Stack.Screen options={{ title: name ?? t('tabs.parties') }} />
      <QueryBoundary query={detailQuery}>
        {() => (
          <>
            <Card>
              <Badge label={type === 'supplier' ? t('parties.supplier') : t('parties.customer')} tone="primary" />
              <AppText variant="caption">{t('suppliers.balance')}</AppText>
              <AppText variant="title" style={{ color: owed ? owedColor : colors.foreground, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(balance ?? 0)}
              </AppText>
              <AppText variant="caption">{owed ? (type === 'supplier' ? t('parties.weOwe') : t('parties.owesUs')) : t('parties.settled')}</AppText>
              {contacts.filter(Boolean).map((line) => (
                <AppText key={line} variant="muted">{line}</AppText>
              ))}
            </Card>
            <AppButton label={t('money.recordPayment')} onPress={() => setSheet(true)} disabled={!canRecord} />
            {sheet && (
              <MoneyActionSheet
                visible
                onClose={() => setSheet(false)}
                party={type}
                partyId={partyId}
                partyName={name ?? ''}
                currentBalance={balance ?? 0}
              />
            )}
          </>
        )}
      </QueryBoundary>

      <AppText variant="heading">{type === 'supplier' ? t('suppliers.ledger') : t('customers.statement')}</AppText>
      <QueryBoundary query={ledgerQuery}>
        {() => (
          <View style={{ marginHorizontal: -16 }}>
            {(lines ?? []).length === 0 ? <AppText variant="muted" style={{ padding: 16 }}>{t('common.noResults')}</AppText> : null}
            {(lines ?? []).map((l) => (
              <ListRow
                key={l.key}
                title={l.title}
                subtitle={l.subtitle}
                trailing={`${l.amount > 0 ? '+' : ''}${formatCurrency(l.amount)}`}
                trailingColor={l.amount > 0 ? colors.destructive : colors.success}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  )
}
