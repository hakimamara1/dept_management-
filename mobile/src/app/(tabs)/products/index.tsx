import { useMemo, useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ListRow, Screen, Segmented, TextField } from '@/shared/components/ui'
import { IconBubble } from '@/shared/components/Badge'
import { ScreenHeader } from '@/shared/components/ScreenHeader'
import { SkeletonRows } from '@/shared/components/Skeleton'
import { EmptyBlock, ErrorBlock } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { useDebounced } from '@/shared/lib/useDebounced'
import { MIN_TOUCH, radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { ProductFormSheet } from '@/modules/products/components/ProductFormSheet'
import { useProducts } from '@/modules/products/hooks/useProducts'
import { marginPercent, unitCost } from '@/modules/products/lib/metrics'

type Sort = 'name' | 'margin' | 'stock'

export default function ProductsScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const router = useRouter()
  const [text, setText] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [creating, setCreating] = useState(false)
  const query = useProducts(useDebounced(text.trim()))

  const rows = useMemo(() => {
    const list = (query.data ?? []).map((p) => ({ p, margin: marginPercent(p.default_sale_price, unitCost(p)) }))
    if (sort === 'margin') list.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity))
    if (sort === 'stock') list.sort((a, b) => (b.p.current_stock ?? 0) - (a.p.current_stock ?? 0))
    return list // 'name' keeps the server's order (already sorted by name)
  }, [query.data, sort])

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('tabs.products')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('products.new')}
            onPress={() => setCreating(true)}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
          >
            <Ionicons name="add" size={26} color={colors.primaryForeground} />
          </Pressable>
        }
      />
      <TextField value={text} onChangeText={setText} placeholder={t('products.search')} />
      <Segmented
        value={sort}
        onChange={setSort}
        options={[
          { value: 'name', label: t('products.sort.name') },
          { value: 'margin', label: t('products.sort.margin') },
          { value: 'stock', label: t('products.sort.stock') }
        ]}
      />
      <View style={{ flex: 1, marginHorizontal: -spacing.lg }}>
        {query.isLoading ? (
          <SkeletonRows />
        ) : query.error ? (
          <ErrorBlock message={errorText(query.error, t)} onRetry={() => query.refetch()} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.p.id)}
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            ListEmptyComponent={<EmptyBlock icon="pricetags-outline" title={t('common.noResults')} actionLabel={t('products.new')} onAction={() => setCreating(true)} />}
            renderItem={({ item: { p, margin } }) => (
              <ListRow
                leading={<IconBubble><Ionicons name="pricetag-outline" size={20} color={colors.primary} /></IconBubble>}
                title={p.name}
                subtitle={[
                  p.unit ? t(`unit.${p.unit}` as 'unit.piece') : null,
                  `${t('products.stock')}: ${p.current_stock ?? 0}`,
                  margin != null ? `${t('products.margin')} ${formatPercent(margin, 0)}` : null
                ].filter(Boolean).join(' · ')}
                trailing={p.default_sale_price != null ? formatCurrency(p.default_sale_price) : t('products.notSet')}
                trailingColor={p.default_sale_price != null ? colors.foreground : colors.mutedForeground}
                trailingCaption={p.last_purchase_price != null ? `${t('products.buy')} ${formatCurrency(p.last_purchase_price)}` : undefined}
                onPress={() => router.push(`/products/${p.id}`)}
              />
            )}
          />
        )}
      </View>
      <ProductFormSheet visible={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/products/${id}`)} />
    </Screen>
  )
}
