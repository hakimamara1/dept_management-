import { useMemo, useState } from 'react'
import { Pressable, SectionList, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ExpirationBatch } from '@desktop-types/api'
import { AppText, ListRow, Screen, TextField } from '@/shared/components/ui'
import { IconBubble } from '@/shared/components/Badge'
import { ScreenHeader } from '@/shared/components/ScreenHeader'
import { SkeletonRows } from '@/shared/components/Skeleton'
import { EmptyBlock, ErrorBlock } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatDate } from '@/shared/lib/format'
import { normalizeName } from '@/shared/lib/normalizeName'
import { MIN_TOUCH, radius, spacing, useTheme } from '@/shared/theme/useTheme'
import { BatchFormSheet } from '@/modules/expiry/components/BatchFormSheet'
import { BatchSheet } from '@/modules/expiry/components/BatchSheet'
import { useExpiryBatches } from '@/modules/expiry/hooks/useExpiry'
import { daysLabel } from '@/modules/expiry/lib/format'
import { OPEN_BUCKETS, daysLeft, groupBatches, type Bucket } from '@/modules/expiry/lib/urgency'

type Filter = 'all' | Bucket

export default function ExpiryScreen() {
  const { t } = useI18n()
  const { colors } = useTheme()
  const query = useExpiryBatches()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<ExpirationBatch | null>(null)

  const grouped = useMemo(() => {
    const needle = normalizeName(text)
    const all = (query.data ?? []).filter(
      (b) => !needle || normalizeName(b.product_name).includes(needle) || normalizeName(b.batch_number).includes(needle) || (b.product_barcode ?? '').includes(text.trim())
    )
    return groupBatches(all)
  }, [query.data, text])

  const bucketMeta: Record<Bucket, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    expired: { label: t('expiry.bucket.expired'), icon: 'close-circle', color: colors.destructive },
    week: { label: t('expiry.bucket.week'), icon: 'alert-circle', color: colors.warning },
    month: { label: t('expiry.bucket.month'), icon: 'time', color: colors.warning },
    later: { label: t('expiry.bucket.later'), icon: 'checkmark-circle', color: colors.success },
    closed: { label: t('expiry.bucket.closed'), icon: 'archive', color: colors.mutedForeground }
  }

  // The 'all' view shows the open buckets; closed batches only appear when asked for (they are history, not work).
  const visible: Bucket[] = filter === 'all' ? OPEN_BUCKETS : [filter]
  const sections = visible.filter((b) => grouped[b].length > 0).map((b) => ({ bucket: b, data: grouped[b] }))
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('parties.all'), count: OPEN_BUCKETS.reduce((n, b) => n + grouped[b].length, 0) },
    ...(['expired', 'week', 'month', 'later', 'closed'] as Bucket[]).map((b) => ({ key: b as Filter, label: bucketMeta[b].label, count: grouped[b].length }))
  ]

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('tabs.expiry')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('expiry.add')}
            onPress={() => setAdding(true)}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
          >
            <Ionicons name="add" size={26} color={colors.primaryForeground} />
          </Pressable>
        }
      />
      <TextField value={text} onChangeText={setText} placeholder={t('expiry.search')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {chips.map((c) => {
          const active = filter === c.key
          const urgent = (c.key === 'expired' || c.key === 'week') && c.count > 0
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(c.key)}
              style={{
                minHeight: 40,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.accent : colors.card
              }}
            >
              <Text style={{ color: active ? colors.accentForeground : colors.foreground, fontWeight: active ? '700' : '500', fontSize: 13 }}>{c.label}</Text>
              <Text style={{ color: urgent ? colors.destructive : colors.mutedForeground, fontWeight: '700', fontSize: 13 }}>{c.count}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={{ flex: 1, marginHorizontal: -spacing.lg }}>
        {query.isLoading ? (
          <SkeletonRows />
        ) : query.error ? (
          <ErrorBlock message={errorText(query.error, t)} onRetry={() => query.refetch()} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(b) => String(b.id)}
            stickySectionHeadersEnabled={false}
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            ListEmptyComponent={
              <EmptyBlock
                icon="hourglass-outline"
                title={t('expiry.empty')}
                body={t('expiry.emptyBody')}
                actionLabel={t('expiry.add')}
                onAction={() => setAdding(true)}
              />
            }
            renderSectionHeader={({ section }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
                <Ionicons name={bucketMeta[section.bucket].icon} size={18} color={bucketMeta[section.bucket].color} />
                <AppText variant="heading">{bucketMeta[section.bucket].label}</AppText>
                <AppText variant="caption">{section.data.length}</AppText>
              </View>
            )}
            renderItem={({ item, section }) => {
              const meta = bucketMeta[section.bucket]
              const days = daysLeft(item.expiration_date)
              return (
                <ListRow
                  leading={
                    <IconBubble tone="neutral">
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </IconBubble>
                  }
                  title={item.product_name}
                  subtitle={[item.batch_number, item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : null, item.location]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={section.bucket === 'closed' ? undefined : daysLabel(days, t)}
                  trailingColor={meta.color}
                  trailingCaption={formatDate(item.expiration_date)}
                  onPress={() => setSelected(item)}
                />
              )
            }}
          />
        )}
      </View>

      <BatchFormSheet visible={adding} onClose={() => setAdding(false)} />
      <BatchSheet batch={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}
