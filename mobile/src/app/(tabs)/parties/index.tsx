import { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ListRow, Screen, Segmented, TextField } from '@/shared/components/ui'
import { IconBubble } from '@/shared/components/Badge'
import { ScreenHeader } from '@/shared/components/ScreenHeader'
import { SkeletonRows } from '@/shared/components/Skeleton'
import { EmptyBlock, ErrorBlock } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatCurrency } from '@/shared/lib/format'
import { useDebounced } from '@/shared/lib/useDebounced'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { useCustomers } from '@/modules/customers/hooks/useCustomers'
import { byBalanceDesc, fromCustomer, fromSupplier, type PartyRow } from '@/modules/parties/lib/parties'
import { useSuppliers } from '@/modules/suppliers/hooks/useSuppliers'

type Filter = 'all' | 'supplier' | 'customer'

/** Suppliers and customers in one list. Money actions only — invoices are handled on the desktop. */
export default function PartiesScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())
  const suppliers = useSuppliers(q)
  const customers = useCustomers(q)

  const active = filter === 'supplier' ? [suppliers] : filter === 'customer' ? [customers] : [suppliers, customers]
  const loading = active.some((a) => a.isLoading)
  const failed = active.find((a) => a.error)
  const refreshing = active.some((a) => a.isRefetching)

  const rows = useMemo<PartyRow[]>(() => {
    const out: PartyRow[] = []
    if (filter !== 'customer') out.push(...(suppliers.data ?? []).map(fromSupplier))
    if (filter !== 'supplier') out.push(...(customers.data ?? []).map(fromCustomer))
    return out.sort(byBalanceDesc)
  }, [filter, suppliers.data, customers.data])

  const typeLabel = (r: PartyRow) => (r.type === 'supplier' ? t('parties.supplier') : t('parties.customer'))

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('tabs.parties')} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('parties.all') },
          { value: 'supplier', label: t('tabs.suppliers') },
          { value: 'customer', label: t('tabs.customers') }
        ]}
      />
      <TextField value={text} onChangeText={setText} placeholder={t('parties.searchHint')} />
      <View style={{ flex: 1, marginHorizontal: -spacing.lg }}>
        {loading ? (
          <SkeletonRows />
        ) : failed ? (
          <ErrorBlock message={errorText(failed.error, t)} onRetry={() => active.forEach((a) => a.refetch())} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            refreshing={refreshing}
            onRefresh={() => active.forEach((a) => a.refetch())}
            ListEmptyComponent={<EmptyBlock icon="search-outline" title={t('common.noResults')} />}
            renderItem={({ item }) => {
              const owed = item.balance > 0
              const color = !owed ? colors.mutedForeground : item.type === 'supplier' ? colors.destructive : colors.warning
              return (
                <ListRow
                  leading={
                    <IconBubble tone={item.type === 'supplier' ? 'primary' : 'neutral'}>
                      <Ionicons name={item.type === 'supplier' ? 'cube-outline' : 'person-outline'} size={20} color={colors.primary} />
                    </IconBubble>
                  }
                  title={item.name}
                  subtitle={[typeLabel(item), item.invoiceCount != null ? `${t('suppliers.invoices')}: ${item.invoiceCount}` : null, item.phone].filter(Boolean).join(' · ')}
                  trailing={formatCurrency(item.balance)}
                  trailingColor={color}
                  trailingCaption={owed ? (item.type === 'supplier' ? t('parties.weOwe') : t('parties.owesUs')) : t('parties.settled')}
                  onPress={() => router.push(`/parties/${item.type}/${item.id}`)}
                />
              )
            }}
          />
        )}
      </View>
    </Screen>
  )
}
