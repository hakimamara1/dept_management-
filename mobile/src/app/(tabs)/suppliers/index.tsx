import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ListRow, Screen, TextField, AppText } from '@/shared/components/ui'
import { EmptyBlock, QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { useDebounced } from '@/shared/lib/useDebounced'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { useSuppliers } from '@/modules/suppliers/hooks/useSuppliers'

export default function SuppliersScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const [text, setText] = useState('')
  const query = useSuppliers(useDebounced(text.trim()))

  return (
    <Screen scroll={false}>
      <AppText variant="title">{t('tabs.suppliers')}</AppText>
      <TextField value={text} onChangeText={setText} placeholder={t('common.search')} />
      <View style={{ flex: 1, marginHorizontal: -spacing.lg }}>
        <QueryBoundary query={query}>
          {(suppliers) => (
            <FlatList
              data={suppliers}
              keyExtractor={(s) => String(s.id)}
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              ListEmptyComponent={<EmptyBlock title={t('common.noResults')} />}
              renderItem={({ item }) => (
                <ListRow
                  title={item.name}
                  subtitle={`${t('suppliers.invoices')}: ${item.invoice_count ?? 0} · ${t('suppliers.lastInvoice')}: ${item.last_invoice_date ? formatDate(item.last_invoice_date) : '—'}`}
                  trailing={formatCurrency(item.current_balance)}
                  trailingColor={item.current_balance > 0 ? colors.destructive : colors.mutedForeground}
                  onPress={() => router.push(`/suppliers/${item.id}`)}
                />
              )}
            />
          )}
        </QueryBoundary>
      </View>
    </Screen>
  )
}
