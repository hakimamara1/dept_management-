import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useI18n } from '@/shared/i18n/useI18n'
import { spacing, useTheme } from '@/shared/theme/useTheme'
import { AppButton, AppText, CenteredMessage } from './ui'

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

export function EmptyBlock({ title }: { title: string }) {
  return <CenteredMessage title={title} />
}

/** Loading → error (with retry) → content, so each screen only writes its happy path. */
export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isLoading) return <LoadingBlock />
  if (query.error || query.data === undefined) return <ErrorBlock message={query.error?.message} onRetry={() => query.refetch()} />
  return <>{children(query.data)}</>
}
