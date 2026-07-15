import { Globe, Monitor, Moon, Sun } from 'lucide-react'
import { useI18n } from '@shared/lib/i18n'
import { useUiStore, type AppLanguage, type ThemePreference } from '@shared/store/ui-store'
import { useBackendHealth } from '@shared/hooks/useBackendHealth'
import { Button } from '@shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/lib/utils'

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light'
}

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const

const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' }
]

export function Topbar() {
  const { t } = useI18n()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const { data: health, isError } = useBackendHealth()

  const ThemeIcon = THEME_ICON[theme]
  const isOnline = !isError && health?.status === 'ok'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn('size-2 rounded-full', isOnline ? 'bg-success' : 'bg-destructive')} />
        {isOnline ? 'متصل بقاعدة البيانات المحلية' : 'غير متصل — يتعذر الوصول للخادم المحلي'}
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.search')}>
              <Globe className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LANGUAGES.map((l) => (
              <DropdownMenuItem key={l.value} onSelect={() => setLanguage(l.value)}>
                <span className={cn(l.value === language && 'font-semibold text-primary')}>{l.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={() => setTheme(THEME_CYCLE[theme])} aria-label="تبديل المظهر">
          <ThemeIcon className="size-4" />
        </Button>
      </div>
    </header>
  )
}
