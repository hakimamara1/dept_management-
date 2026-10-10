import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { Ionicons } from '@expo/vector-icons'
import { AppButton, AppText } from './ui'
import { SkeletonRows } from './Skeleton'

/** Compact spinner for small inline areas (a sheet's list); full screens use skeletons. */
export function LoadingBlock() {
  const { colors } = useTheme()
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
      <AppText variant="muted" style={{ textAlign: 'center' }}>{message || t('common.error')}</AppText>
      <AppButton variant="outline" label={t('common.retry')} onPress={onRetry} />
    </View>
  )
}

export function EmptyBlock({
  title,
  body,
  icon = 'file-tray-outline',
  actionLabel,
  onAction
}: {
  title: string
  body?: string
  icon?: keyof typeof Ionicons.glyphMap
  actionLabel?: string
  onAction?: () => void
}) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <Ionicons name={icon} size={44} color={colors.mutedForeground} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      {body ? <AppText variant="muted" style={{ textAlign: 'center' }}>{body}</AppText> : null}
      {actionLabel && onAction ? <AppButton variant="outline" label={actionLabel} onPress={onAction} /> : null}
    </View>
  )
}

/** Loading → error (with retry) → content, so each screen only writes its happy path. */
export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  const { t } = useI18n()
  if (query.isLoading) return <SkeletonRows />
  if (query.error || query.data === undefined) {
    return <ErrorBlock message={query.error ? errorText(query.error, t) : undefined} onRetry={() => query.refetch()} />
  }
  return <>{children(query.data)}</>
}
