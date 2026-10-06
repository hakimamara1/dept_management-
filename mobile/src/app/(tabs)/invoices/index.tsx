import { FlatList, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { AppButton, AppText, ListRow, Screen } from '@/shared/components/ui'
import { EmptyBlock, QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { usePendingInvoices } from '@/modules/invoices/hooks/useInvoices'

export default function InvoicesScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const pending = usePendingInvoices()

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (!result.canceled && result.assets[0]) router.push({ pathname: '/invoices/scan', params: { uri: result.assets[0].uri } })
  }

  return (
    <Screen scroll={false}>
      <AppText variant="title">{t('tabs.invoices')}</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><AppButton label={t('scan.scan')} onPress={() => router.push('/invoices/scan')} /></View>
        <View style={{ flex: 1 }}><AppButton variant="outline" label={t('scan.fromGallery')} onPress={pickFromGallery} /></View>
      </View>
      <AppText variant="heading">{t('scan.pending')}</AppText>
      <View style={{ flex: 1, marginHorizontal: -spacing.lg }}>
        <QueryBoundary query={pending}>
          {(rows) => (
            <FlatList
              data={rows}
              keyExtractor={(i) => String(i.id)}
              refreshing={pending.isRefetching}
              onRefresh={() => pending.refetch()}
              ListEmptyComponent={<EmptyBlock title={t('scan.nonePending')} />}
              renderItem={({ item }) => (
                <ListRow
                  title={`${item.invoice_number}${item.supplier_name ? ` · ${item.supplier_name}` : ''}`}
                  subtitle={`${formatDate(item.invoice_date)} · ${item.pending_items ?? 0} ${t('scan.unmatched')}`}
                  trailing={formatCurrency(item.invoice_amount)}
                  trailingColor={colors.foreground}
                  onPress={() => router.push(`/invoices/${item.id}`)}
                />
              )}
            />
          )}
        </QueryBoundary>
      </View>
    </Screen>
  )
}
