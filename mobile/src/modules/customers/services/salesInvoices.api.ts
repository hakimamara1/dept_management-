import { api } from '@/shared/api/client'
import type {
  AddSalesInvoiceItemInput,
  CreateSalesInvoiceInput,
  Product,
  SalesInvoiceDetail,
  SalesInvoiceListItem,
  UpdateSalesInvoiceItemInput
} from '@desktop-types/api'

const base = (customerId: number, invoiceId?: number) =>
  `/api/customers/${customerId}/invoices${invoiceId != null ? `/${invoiceId}` : ''}`

export const salesInvoicesApi = {
  list: (customerId: number) => api.get<SalesInvoiceListItem[]>(base(customerId)),
  get: (customerId: number, invoiceId: number) => api.get<SalesInvoiceDetail>(base(customerId, invoiceId)),
  create: (customerId: number, data: CreateSalesInvoiceInput, key: string) =>
    api.post<SalesInvoiceDetail>(base(customerId), data, { idempotencyKey: key }),
  updateItem: (customerId: number, invoiceId: number, itemId: number, data: UpdateSalesInvoiceItemInput) =>
    api.patch<SalesInvoiceDetail>(`${base(customerId, invoiceId)}/items/${itemId}`, data),
  addItem: (customerId: number, invoiceId: number, data: AddSalesInvoiceItemInput) =>
    api.post<SalesInvoiceDetail>(`${base(customerId, invoiceId)}/items`, data),
  deleteItem: (customerId: number, invoiceId: number, itemId: number) =>
    api.delete<SalesInvoiceDetail>(`${base(customerId, invoiceId)}/items/${itemId}`),
  updateNotes: (customerId: number, invoiceId: number, notes: string) =>
    api.patch<SalesInvoiceDetail>(`${base(customerId, invoiceId)}/notes`, { notes }),
  deleteInvoice: (customerId: number, invoiceId: number) =>
    api.delete<{ success: boolean }>(base(customerId, invoiceId)),
  approve: (customerId: number, invoiceId: number, key: string) =>
    api.post<SalesInvoiceDetail>(`${base(customerId, invoiceId)}/approve`, undefined, { idempotencyKey: key }),
  searchProducts: (query: string) => api.get<Product[]>(`/api/products/search?query=${encodeURIComponent(query)}`)
}
