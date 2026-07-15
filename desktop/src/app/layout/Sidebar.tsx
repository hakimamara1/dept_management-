import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, Receipt } from 'lucide-react'
import { NAV_ITEMS } from '@shared/constants/nav'
import { useI18n } from '@shared/lib/i18n'
import { useUiStore } from '@shared/store/ui-store'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/lib/utils'

export function Sidebar() {
  const { t } = useI18n()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-e border-border bg-card transition-[width] duration-150',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Receipt className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">نظام إدارة المشتريات</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between gap-2 truncate">
                {t(item.labelKey)}
                {item.comingSoon && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {t('common.comingSoonTitle')}
                  </Badge>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <Button variant="ghost" size="sm" className="w-full justify-center" onClick={toggleSidebar}>
          {collapsed ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
        </Button>
      </div>
    </aside>
  )
}
