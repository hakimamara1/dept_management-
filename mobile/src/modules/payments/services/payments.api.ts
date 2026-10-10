import { api } from '@/shared/api/client'
import type { RecordCustomerPaymentInput, RecordPaymentInput } from '@desktop-types/api'

/**
 * Every call takes the idempotency key: a retried request must replay, never record twice.
 * Balance adjustments are deliberately absent — they are done on the desktop (and blocked by the gateway).
 */
export const paymentsApi = {
  recordSupplierPayment: (supplierId: number, data: RecordPaymentInput, key: string) =>
    api.post(`/api/suppliers/${supplierId}/payments`, data, { idempotencyKey: key }),
  recordCustomerPayment: (customerId: number, data: RecordCustomerPaymentInput, key: string) =>
    api.post(`/api/customers/${customerId}/payments`, data, { idempotencyKey: key })
}
