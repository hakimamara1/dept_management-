import { apiClient } from '@shared/lib/api-client'
import type {
  AddSalesInvoiceItemInput,
  AdjustBalanceInput,
  Customer,
  CustomerPayment,
  CustomerReportsSummary,
  CustomerStatementEntry,
  CreateCustomerInput,
  CreateSalesInvoiceInput,
  RecordCustomerPaymentInput,
  SalesInvoiceDetail,
  SalesInvoiceListItem,
  UpdateSalesInvoiceItemInput
} from '@shared/types/api'

export const customersApi = {
  list: (query = '') => apiClient.get<Customer[]>(`/api/customers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getById: (id: number) => apiClient.get<Customer>(`/api/customers/${id}`),
  create: (data: CreateCustomerInput) => apiClient.post<Customer>('/api/customers', data),
  getReportsSummary: () => apiClient.get<CustomerReportsSummary>('/api/customers/reports/summary'),

  getInvoices: (customerId: number) =>
    apiClient.get<SalesInvoiceListItem[]>(`/api/customers/${customerId}/invoices`),
  getInvoice: (customerId: number, invoiceId: number) =>
    apiClient.get<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}`),
  createInvoice: (customerId: number, data: CreateSalesInvoiceInput) =>
    apiClient.post<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices`, data),
  updateInvoiceItem: (customerId: number, invoiceId: number, itemId: number, data: UpdateSalesInvoiceItemInput) =>
    apiClient.patch<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}/items/${itemId}`, data),
  addInvoiceItem: (customerId: number, invoiceId: number, data: AddSalesInvoiceItemInput) =>
    apiClient.post<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}/items`, data),
  deleteInvoiceItem: (customerId: number, invoiceId: number, itemId: number) =>
    apiClient.delete<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}/items/${itemId}`),
  updateInvoiceNotes: (customerId: number, invoiceId: number, notes: string) =>
    apiClient.patch<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}/notes`, { notes }),
  deleteInvoice: (customerId: number, invoiceId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/customers/${customerId}/invoices/${invoiceId}`),
  approveInvoice: (customerId: number, invoiceId: number) =>
    apiClient.post<SalesInvoiceDetail>(`/api/customers/${customerId}/invoices/${invoiceId}/approve`),

  getPayments: (customerId: number) =>
    apiClient.get<CustomerPayment[]>(`/api/customers/${customerId}/payments`),
  recordPayment: (customerId: number, data: RecordCustomerPaymentInput) =>
    apiClient.post<CustomerPayment>(`/api/customers/${customerId}/payments`, data),

  getStatement: (customerId: number) =>
    apiClient.get<CustomerStatementEntry[]>(`/api/customers/${customerId}/statement`),

  adjustBalance: (customerId: number, data: AdjustBalanceInput) =>
    apiClient.post(`/api/customers/${customerId}/adjust`, data)
}
