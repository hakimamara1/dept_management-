import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@shared/lib/i18n'

interface ComingSoonPageProps {
  icon: LucideIcon
  title: string
}

/**
 * Honest placeholder for the 8 modules not built in this phase — a real,
 * navigable route rather than a dead link, but making no claim of
 * functionality it doesn't have.
 */
export function ComingSoonPage({ icon: Icon, title }: ComingSoonPageProps) {
  const { t } = useI18n()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <div>
        <div className="text-base font-semibold text-foreground">{title}</div>
        <div className="text-sm font-medium text-muted-foreground">{t('common.comingSoonTitle')}</div>
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{t('common.comingSoonBody')}</p>
    </div>
  )
}
