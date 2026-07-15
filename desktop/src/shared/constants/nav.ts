import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Bot,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet
} from 'lucide-react'
import type { TranslationKey } from '@shared/lib/i18n'

export interface NavItem {
  path: string
  labelKey: TranslationKey
  icon: LucideIcon
  /** false = real, built module. true = routes to ComingSoonPage this phase. */
  comingSoon: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, comingSoon: false },
  { path: '/products', labelKey: 'nav.products', icon: Package, comingSoon: false },
  { path: '/suppliers', labelKey: 'nav.suppliers', icon: Users, comingSoon: false },
  { path: '/customers', labelKey: 'nav.customers', icon: ShoppingBag, comingSoon: false },
  { path: '/purchase-orders', labelKey: 'nav.purchaseOrders', icon: ShoppingCart, comingSoon: false },
  { path: '/invoices', labelKey: 'nav.invoices', icon: Receipt, comingSoon: false },
  { path: '/payments', labelKey: 'nav.payments', icon: Wallet, comingSoon: false },
  { path: '/reports', labelKey: 'nav.reports', icon: FileText, comingSoon: false },
  { path: '/notifications', labelKey: 'nav.notifications', icon: Bell, comingSoon: true },
  { path: '/ai-assistant', labelKey: 'nav.aiAssistant', icon: Bot, comingSoon: true },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings, comingSoon: true }
]
