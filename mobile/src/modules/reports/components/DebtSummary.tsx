import { useMemo, useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import type { DebtAnalysis, DebtScope } from '@desktop-types/api'
import { AppText, Card, KpiTile, Segmented } from '@/shared/components/ui'
import { GroupedBars, TrendChart } from '@/shared/components/charts'
import { QueryBoundary } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/shared/lib/format'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { useDebtAnalysis } from '../hooks/useDebtAnalysis'
import { buildVerdict } from '../lib/debtVerdict'
import { DebtVerdictBanner } from './DebtVerdictBanner'

// Same categorical series colours the desktop charts use (--chart-1/2/3), light and dark.
const SERIES = {
  light: { purchases: '#2a78d6', payments: '#1baf7a', adjustments: '#eda100' },
  dark: { purchases: '#3987e5', payments: '#199e70', adjustments: '#c98500' }
}

function Body({ data }: { data: DebtAnalysis }) {
  const { t, language } = useI18n()
  const { width } = useWindowDimensions()
  const { isDark } = useTheme()
  const verdict = useMemo(() => buildVerdict(data, language), [data, language])
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2
  const c = data.current
  const isSuppliers = data.scope === 'suppliers'
  const palette = isDark ? SERIES.dark : SERIES.light

  return (
    <>
      <DebtVerdictBanner verdict={verdict} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <KpiTile label={t('debt.ending')} value={formatCompactCurrency(c.ending)} />
        <KpiTile label={t('debt.change')} value={`${c.change > 0 ? '+' : ''}${formatCompactCurrency(c.change)}`} tone={c.change < 0 ? 'good' : c.change > 0 ? 'bad' : undefined} />
        <KpiTile label={isSuppliers ? t('debt.purchases') : t('debt.sales')} value={formatCompactCurrency(c.purchases)} />
        <KpiTile label={isSuppliers ? t('debt.payments') : t('debt.collections')} value={formatCompactCurrency(c.payments)} />
        <KpiTile label={t('debt.adjustments')} value={formatCompactCurrency(c.adjustments)} />
        <KpiTile label={t('debt.ratio')} value={c.paymentRatio == null ? '—' : `${c.paymentRatio}%`} />
      </View>

      <Card>
        <AppText variant="heading">{t('debt.trend')}</AppText>
        {data.evolution.length === 0 ? (
          <AppText variant="muted">{t('common.noResults')}</AppText>
        ) : (
          <TrendChart width={chartWidth} points={data.evolution.map((e) => ({ date: e.date, value: e.debt }))} />
        )}
      </Card>

      <Card>
        <AppText variant="heading">{isSuppliers ? t('debt.purchasesVsPayments') : t('debt.salesVsCollections')}</AppText>
        <GroupedBars
          width={chartWidth}
          series={[
            { key: 'purchases', color: palette.purchases, label: isSuppliers ? t('debt.purchases') : t('debt.sales'), values: data.perPeriod.map((p) => p.purchases) },
            { key: 'payments', color: palette.payments, label: isSuppliers ? t('debt.payments') : t('debt.collections'), values: data.perPeriod.map((p) => p.payments) },
            { key: 'adjustments', color: palette.adjustments, label: t('debt.adjustments'), values: data.perPeriod.map((p) => p.adjustments) }
          ]}
        />
      </Card>

      <Card>
        <AppText variant="heading">{t('debt.recent')}</AppText>
        {data.transactions.length === 0 ? (
          <AppText variant="muted">{t('common.noResults')}</AppText>
        ) : (
          data.transactions.slice(0, 15).map((tx) => (
            <View key={tx.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" numberOfLines={1}>{tx.entityName}{tx.reference ? ` · #${tx.reference}` : ''}</AppText>
                <AppText variant="caption">{formatDate(tx.date)} · {t(`debt.type.${tx.type}` as const)}</AppText>
              </View>
              <AppText variant="body" style={{ color: tx.amount > 0 ? '#b3261e' : '#1c7c4b', fontVariant: ['tabular-nums'] }}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </AppText>
            </View>
          ))
        )}
      </Card>
    </>
  )
}

const RANGES = ['week', 'month', '3months', 'year'] as const
type HomeRange = (typeof RANGES)[number]

/** Home: debt verdict + KPIs + charts for suppliers or customers over a chosen period. */
export function DebtSummary() {
  const { t } = useI18n()
  const [scope, setScope] = useState<DebtScope>('suppliers')
  const [range, setRange] = useState<HomeRange>('month')
  const query = useDebtAnalysis({ scope, range })

  return (
    <>
      <Segmented<DebtScope>
        value={scope}
        onChange={setScope}
        options={[{ value: 'suppliers', label: t('debt.scope.suppliers') }, { value: 'customers', label: t('debt.scope.customers') }]}
      />
      <Segmented<HomeRange>
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: t(`range.${r}` as const) }))}
      />
      <QueryBoundary query={query}>{(data) => <Body data={data} />}</QueryBoundary>
    </>
  )
}
