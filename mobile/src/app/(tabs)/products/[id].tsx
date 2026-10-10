import { useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { AppButton, AppText, Card, KpiTile, ListRow, Screen, Segmented } from '@/shared/components/ui'
import { EmptyBlock, QueryBoundary } from '@/shared/components/states'
import { SkeletonRows } from '@/shared/components/Skeleton'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCurrency, formatDate, formatPercent } from '@/shared/lib/format'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { PriceHistoryChart, type PriceSeries } from '@/modules/products/components/PriceHistoryChart'
import { ProductFormSheet } from '@/modules/products/components/ProductFormSheet'
import { SalePriceSheet } from '@/modules/products/components/SalePriceSheet'
import { useBuyHistory, useProduct, useSellHistory } from '@/modules/products/hooks/useProducts'
import { bySupplier, inRange, marginAmount, marginPercent, unitCost, type RangeKey } from '@/modules/products/lib/metrics'

export default function ProductDetailScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const productId = Number(id)
  const product = useProduct(productId)
  const buy = useBuyHistory(productId)
  const sell = useSellHistory(productId)
  const [range, setRange] = useState<RangeKey>('1y')
  const [editing, setEditing] = useState(false)
  const [pricing, setPricing] = useState(false)

  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2 // screen padding + card padding

  const buyPoints = useMemo(() => (buy.data?.points ?? []).map((p) => ({ date: p.date, value: p.price, party: p.supplier, quantity: p.quantity })), [buy.data])
  const sellPoints = useMemo(() => (sell.data?.points ?? []).map((p) => ({ date: p.date, value: p.price, party: p.customer, quantity: p.quantity })), [sell.data])

  const series: PriceSeries[] = [
    { key: 'buy', label: t('products.buyLine'), color: colors.primary, shape: 'circle', points: inRange(buyPoints, range) },
    { key: 'sell', label: t('products.sellLine'), color: colors.warning, shape: 'diamond', dashed: true, points: inRange(sellPoints, range) }
  ]
  const suppliers = useMemo(() => bySupplier((buy.data?.points ?? []).map((p) => ({ date: p.date, price: p.price, supplier: p.supplier }))), [buy.data])
  const histLoading = buy.isLoading || sell.isLoading
  const noHistory = !histLoading && buyPoints.length === 0 && sellPoints.length === 0

  return (
    <Screen>
      <Stack.Screen options={{ title: product.data?.name ?? t('tabs.products') }} />
      <QueryBoundary query={product}>
        {(p) => {
          const cost = unitCost(p)
          const pct = marginPercent(p.default_sale_price, cost)
          const amount = marginAmount(p.default_sale_price, cost)
          return (
            <>
              <Card>
                <AppText variant="heading">{p.name}</AppText>
                <AppText variant="muted">
                  {[p.unit ? t(`unit.${p.unit}` as 'unit.piece') : null, p.category, p.barcode].filter(Boolean).join(' · ') || '—'}
                </AppText>
                <AppText variant="caption">{t('products.stock')}: {p.current_stock ?? 0}</AppText>
              </Card>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <KpiTile label={t('products.lastBuy')} value={p.last_purchase_price != null ? formatCurrency(p.last_purchase_price) : '—'} />
                <KpiTile label={t('products.avgCost')} value={cost != null ? formatCurrency(cost) : '—'} />
                <KpiTile label={t('products.salePrice')} value={p.default_sale_price != null ? formatCurrency(p.default_sale_price) : t('products.notSet')} />
                <KpiTile
                  label={t('products.margin')}
                  value={formatPercent(pct)}
                  tone={pct == null ? undefined : pct < 0 ? 'bad' : 'good'}
                />
              </View>
              {amount != null && (
                <AppText variant="caption">
                  {t('products.margin')}: {formatCurrency(amount)} — {t('products.marginHint')}
                </AppText>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}><AppButton label={t('products.editPrice')} onPress={() => setPricing(true)} /></View>
                <View style={{ flex: 1 }}><AppButton variant="outline" label={t('products.edit')} onPress={() => setEditing(true)} /></View>
              </View>
              <SalePriceSheet visible={pricing} onClose={() => setPricing(false)} product={p} />
              <ProductFormSheet visible={editing} onClose={() => setEditing(false)} product={p} />
            </>
          )
        }}
      </QueryBoundary>

      <AppText variant="heading">{t('products.history')}</AppText>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '3m', label: t('range.3months') },
          { value: '6m', label: t('products.range.6m') },
          { value: '1y', label: t('range.year') },
          { value: 'all', label: t('parties.all') }
        ]}
      />
      {histLoading ? (
        <SkeletonRows count={3} />
      ) : noHistory ? (
        <EmptyBlock icon="analytics-outline" title={t('products.noHistory')} />
      ) : (
        <Card>
          <PriceHistoryChart series={series} width={Math.max(220, chartWidth)} quantityLabel={t('products.qty')} />
          <AppText variant="caption">{t('products.sellNote')}</AppText>
        </Card>
      )}

      {suppliers.length > 0 && (
        <>
          <AppText variant="heading">{t('tabs.suppliers')}</AppText>
          <View style={{ marginHorizontal: -spacing.lg }}>
            {suppliers.map((s, i) => (
              <ListRow
                key={s.name}
                title={s.name}
                subtitle={`${s.count} ${t('products.times')} · ${t('products.buy')} ${formatCurrency(s.min)} ↓`}
                trailing={formatCurrency(s.last)}
                trailingCaption={i === 0 && suppliers.length > 1 ? t('products.cheapest') : formatDate(s.lastDate)}
                trailingColor={i === 0 && suppliers.length > 1 ? colors.success : colors.foreground}
              />
            ))}
          </View>
        </>
      )}

      {buyPoints.length > 0 && (
        <>
          <AppText variant="heading">{t('products.recentBuys')}</AppText>
          <View style={{ marginHorizontal: -spacing.lg }}>
            {[...buyPoints].reverse().slice(0, 5).map((p, i) => (
              <ListRow key={`b${i}`} title={p.party ?? '—'} subtitle={`${formatDate(p.date)} · ${t('products.qty')} ${p.quantity}`} trailing={formatCurrency(p.value)} />
            ))}
          </View>
        </>
      )}

      {sellPoints.length > 0 && (
        <>
          <AppText variant="heading">{t('products.recentSales')}</AppText>
          <View style={{ marginHorizontal: -spacing.lg }}>
            {[...sellPoints].reverse().slice(0, 5).map((p, i) => (
              <ListRow key={`s${i}`} title={p.party ?? '—'} subtitle={`${formatDate(p.date)} · ${t('products.qty')} ${p.quantity}`} trailing={formatCurrency(p.value)} />
            ))}
          </View>
        </>
      )}
    </Screen>
  )
}
