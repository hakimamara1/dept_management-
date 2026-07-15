import { apiClient } from '@shared/lib/api-client'
import type { ApprovedInvoice, InvoiceDecision, InvoiceReviewResponse, PendingInvoice } from '@shared/types/api'

export const invoicesApi = {
  getPending: () => apiClient.get<PendingInvoice[]>('/api/invoices/pending'),
  getApproved: (limit = 100) => apiClient.get<ApprovedInvoice[]>(`/api/invoices/approved?limit=${limit}`),
  getReview: (id: number) => apiClient.get<InvoiceReviewResponse>(`/api/invoices/${id}/review`),
  submit: (ocrJson: unknown) => apiClient.post<{ invoiceId: number; status: string }>('/api/invoices/ocr', ocrJson),
  approve: (id: number, decisions: InvoiceDecision[]) =>
    apiClient.post<{ success: boolean; invoiceId: number }>(`/api/invoices/${id}/approve`, { decisions })
}
