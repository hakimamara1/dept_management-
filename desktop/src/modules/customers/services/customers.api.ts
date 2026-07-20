import { apiClient } from '@shared/lib/api-client'
import type {
  AdjustBalanceInput,
  Customer,
  CustomerPayment,
  CustomerReportsSummary,
  CustomerStatementEntry,
  CreateCustomerInput,
  CreateSalesInvoiceInput,
  RecordCustomerPaymentInput,
  SalesInvoiceDetail,
  SalesInvoiceListItem
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

  getPayments: (customerId: number) =>
    apiClient.get<CustomerPayment[]>(`/api/customers/${customerId}/payments`),
  recordPayment: (customerId: number, data: RecordCustomerPaymentInput) =>
    apiClient.post<CustomerPayment>(`/api/customers/${customerId}/payments`, data),

  getStatement: (customerId: number) =>
    apiClient.get<CustomerStatementEntry[]>(`/api/customers/${customerId}/statement`),

  adjustBalance: (customerId: number, data: AdjustBalanceInput) =>
    apiClient.post(`/api/customers/${customerId}/adjust`, data)
}
