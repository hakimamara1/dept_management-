import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/layout/AppShell'
import { ComingSoonPage } from '@app/layout/ComingSoonPage'
import { NAV_ITEMS } from '@shared/constants/nav'
import { useI18n } from '@shared/lib/i18n'
import { DashboardPage } from '@modules/dashboard'
import { ProductsPage } from '@modules/products'
import { SuppliersPage, SupplierDetailPage } from '@modules/suppliers'
import { InvoicesPage, InvoiceReviewPage } from '@modules/invoices'
import { PurchaseOrdersPage, PurchaseOrderDetailPage } from '@modules/purchase-orders'
import { PaymentsPage } from '@modules/payments'
import { ReportsPage } from '@modules/reports'

function ComingSoonRoute({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const { t } = useI18n()
  return <ComingSoonPage icon={item.icon} title={t(item.labelKey)} />
}

/**
 * HashRouter, not BrowserRouter: once this renderer is loaded from a
 * packaged `file://` path (not a dev server), BrowserRouter's history API
 * has nothing to route against and breaks on refresh/deep links. Hash-based
 * routing is the standard, reload-safe pattern for an Electron renderer.
 */
export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/:id/review" element={<InvoiceReviewPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          {NAV_ITEMS.filter((item) => item.comingSoon).map((item) => (
            <Route key={item.path} path={item.path.slice(1)} element={<ComingSoonRoute item={item} />} />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  )
}
