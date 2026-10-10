import { ApiError } from '@/shared/api/client'
import type { TranslationKey } from '@/shared/i18n/dictionaries'

/** User-facing text for a failed request, in the app language. Server (HTTP) messages are already localized. */
export function errorText(error: unknown, t: (key: TranslationKey) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return t('error.network')
    if (error.code === 'TIMEOUT') return t('error.timeout')
    if (error.code === 'NOT_PAIRED') return t('error.notPaired')
    return error.message
  }
  return t('common.error')
}
