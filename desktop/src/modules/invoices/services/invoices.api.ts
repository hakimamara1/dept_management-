import { apiClient } from '@shared/lib/api-client'
import type {
  AddInvoiceItemInput,
  ApprovedInvoice,
  CreateManualInvoiceInput,
  InvoiceAttachment,
  InvoiceReviewItem,
  InvoiceReviewResponse,
  PendingInvoice,
  UpdateInvoiceItemInput
} from '@shared/types/api'

export const invoicesApi = {
  getPending: () => apiClient.get<PendingInvoice[]>('/api/invoices/pending'),
  getApproved: (limit = 100) => apiClient.get<ApprovedInvoice[]>(`/api/invoices/approved?limit=${limit}`),
  getReview: (id: number) => apiClient.get<InvoiceReviewResponse>(`/api/invoices/${id}/review`),

  // Upload a photo of the invoice — an AI model (Replicate/Gemini) extracts
  // the data server-side, which then lands at Pending Review exactly like
  // the old JSON-paste flow did.
  extract: (file: File) => {
    const formData = new FormData()
    formData.append('invoice', file)
    return apiClient.postForm<{ invoiceId: number; status: string }>('/api/invoices/extract', formData)
  },

  // For a supplier's handwritten invoice — typed in directly, no OCR JSON.
  createManual: (data: CreateManualInvoiceInput) =>
    apiClient.post<{ invoiceId: number; status: string }>('/api/invoices/manual', data),
  addAttachments: (invoiceId: number, files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('photos', file))
    return apiClient.postForm<InvoiceAttachment[]>(`/api/invoices/${invoiceId}/attachments`, formData)
  },
  deleteAttachment: (invoiceId: number, attachmentId: number) =>
    apiClient.delete<InvoiceAttachment[]>(`/api/invoices/${invoiceId}/attachments/${attachmentId}`),

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
    apiClient.patch<{ success: boolean }>(`/api/invoices/${invoiceId}/notes`, { notes }),

  // Whole-invoice delete — for one created by mistake. Pending Review only.
  deleteInvoice: (invoiceId: number) => apiClient.delete<{ success: boolean }>(`/api/invoices/${invoiceId}`)
}
