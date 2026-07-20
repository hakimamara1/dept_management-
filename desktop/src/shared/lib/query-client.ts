import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
})

/**
 * Central query-key registry — every module's hooks build keys from here
 * instead of hand-rolling arrays, so invalidation stays consistent as more
 * modules land.
 */
export const queryKeys = {
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    purchaseTrend: ['dashboard', 'purchase-trend'] as const
  },
  products: {
    all: (query: string, sort: string) => ['products', 'all', query, sort] as const,
    search: (query: string) => ['products', 'search', query] as const,
    priceHistory: (productId: number) => ['products', 'price-history', productId] as const
  },
  stock: {
    low: (threshold: number) => ['stock', 'low', threshold] as const
  },
  invoices: {
    pending: ['invoices', 'pending'] as const,
    approved: (limit: number) => ['invoices', 'approved', limit] as const,
    review: (id: number) => ['invoices', 'review', id] as const
  },
  suppliers: {
    list: (query: string) => ['suppliers', 'list', query] as const,
    aging: ['suppliers', 'aging'] as const,
    detail: (id: number) => ['suppliers', 'detail', id] as const,
    ledger: (id: number) => ['suppliers', 'ledger', id] as const
  },
  purchaseOrders: {
    list: ['purchase-orders', 'list'] as const,
    detail: (id: number) => ['purchase-orders', 'detail', id] as const
  },
  payments: {
    list: ['payments', 'list'] as const
  },
  reports: {
    trialBalance: ['reports', 'trial-balance'] as const,
    balanceSheet: ['reports', 'balance-sheet'] as const,
    profitLoss: ['reports', 'profit-loss'] as const,
    verify: ['reports', 'verify'] as const
  },
  customers: {
    list: (query: string) => ['customers', 'list', query] as const,
    detail: (id: number) => ['customers', 'detail', id] as const,
    invoices: (customerId: number) => ['customers', customerId, 'invoices'] as const,
    invoice: (customerId: number, invoiceId: number) => ['customers', customerId, 'invoices', invoiceId] as const,
    payments: (customerId: number) => ['customers', customerId, 'payments'] as const,
    statement: (customerId: number) => ['customers', customerId, 'statement'] as const,
    reports: ['customers', 'reports'] as const
  },
  expiration: {
    list: (filters: Record<string, unknown>) => ['expiration', 'list', filters] as const,
    detail: (id: number) => ['expiration', 'detail', id] as const,
    dashboard: ['expiration', 'dashboard'] as const,
    report: (kind: string, extra?: number) => ['expiration', 'report', kind, extra] as const
  }
}
