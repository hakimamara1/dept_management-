import { File } from 'expo-file-system'
import { api } from '@/shared/api/client'
import type {
  AddInvoiceItemInput,
  InvoiceReviewResponse,
  PendingInvoice,
  UpdateInvoiceItemInput
} from '@desktop-types/api'

export const invoicesApi = {
  getPending: () => api.get<PendingInvoice[]>('/api/invoices/pending'),
  getReview: (id: number) => api.get<InvoiceReviewResponse>(`/api/invoices/${id}/review`),
  /** Photo → AI extraction can take a minute; the backend limits it to 10 per 10 min per phone. */
  extract: (photo: { uri: string; name: string; type: string }, key: string) => {
    const form = new FormData()
    // SDK 57's fetch only accepts standards Blobs — the old { uri, name, type } React Native part is rejected
    // ("Unsupported FormDataPart implementation") before anything is sent. expo-file-system's File is a Blob.
    form.append('invoice', new File(photo.uri))
    return api.post<{ invoiceId: number; status: string }>('/api/invoices/extract', undefined, {
      form,
      timeoutMs: 120_000,
      idempotencyKey: key
    })
  },
  updateItem: (invoiceId: number, itemId: number, data: UpdateInvoiceItemInput) =>
    api.patch(`/api/invoices/${invoiceId}/items/${itemId}`, data),
  addItem: (invoiceId: number, data: AddInvoiceItemInput) => api.post(`/api/invoices/${invoiceId}/items`, data),
  deleteItem: (invoiceId: number, itemId: number) => api.delete(`/api/invoices/${invoiceId}/items/${itemId}`),
  updateNotes: (invoiceId: number, notes: string) => api.patch(`/api/invoices/${invoiceId}/notes`, { notes }),
  updateSupplier: (invoiceId: number, supplierId: number) => api.patch(`/api/invoices/${invoiceId}/supplier`, { supplierId }),
  approve: (invoiceId: number, key: string) =>
    api.post<{ success: boolean; invoiceId: number }>(`/api/invoices/${invoiceId}/approve`, undefined, { idempotencyKey: key }),
  deleteInvoice: (invoiceId: number) => api.delete(`/api/invoices/${invoiceId}`)
}
