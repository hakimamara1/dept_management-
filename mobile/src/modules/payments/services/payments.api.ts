import { api } from '@/shared/api/client'
import type { AdjustBalanceInput, RecordCustomerPaymentInput, RecordPaymentInput } from '@desktop-types/api'

/** Every call takes the idempotency key: a retried request must replay, never record twice. */
export const paymentsApi = {
  recordSupplierPayment: (supplierId: number, data: RecordPaymentInput, key: string) =>
    api.post(`/api/suppliers/${supplierId}/payments`, data, { idempotencyKey: key }),
  adjustSupplier: (supplierId: number, data: AdjustBalanceInput, key: string) =>
    api.post(`/api/suppliers/${supplierId}/adjust`, data, { idempotencyKey: key }),
  recordCustomerPayment: (customerId: number, data: RecordCustomerPaymentInput, key: string) =>
    api.post(`/api/customers/${customerId}/payments`, data, { idempotencyKey: key }),
  adjustCustomer: (customerId: number, data: AdjustBalanceInput, key: string) =>
    api.post(`/api/customers/${customerId}/adjust`, data, { idempotencyKey: key })
}
