import { apiClient } from '@shared/lib/api-client'
import type {
  AddInvoiceItemInput,
  ApprovedInvoice,
  InvoiceReviewItem,
  InvoiceReviewResponse,
  PendingInvoice,
  UpdateInvoiceItemInput
} from '@shared/types/api'

export const invoicesApi = {
  getPending: () => apiClient.get<PendingInvoice[]>('/api/invoices/pending'),
  getApproved: (limit = 100) => apiClient.get<ApprovedInvoice[]>(`/api/invoices/approved?limit=${limit}`),
  getReview: (id: number) => apiClient.get<InvoiceReviewResponse>(`/api/invoices/${id}/review`),
  submit: (ocrJson: unknown) => apiClient.post<{ invoiceId: number; status: string }>('/api/invoices/ocr', ocrJson),

  // Approve takes no body anymore — matching happens beforehand via the
  // item-editing calls below, the backend just checks everything is resolved.
  approve: (id: number) => apiClient.post<{ success: boolean; invoiceId: number }>(`/api/invoices/${id}/approve`),

  updateItem: (invoiceId: number, itemId: number, data: UpdateInvoiceItemInput) =>
    apiClient.patch<InvoiceReviewItem>(`/api/invoices/${invoiceId}/items/${itemId}`, data),
  addItem: (invoiceId: number, data: AddInvoiceItemInput) =>
    apiClient.post<InvoiceReviewItem>(`/api/invoices/${invoiceId}/items`, data),
  deleteItem: (invoiceId: number, itemId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/invoices/${invoiceId}/items/${itemId}`),
  updateNotes: (invoiceId: number, notes: string) =>
    apiClient.patch<{ success: boolean }>(`/api/invoices/${invoiceId}/notes`, { notes })
}
