import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaymentMethod } from '@/modules/payments/types'
import { paymentsApi } from '../services/payments.api'

export type MoneyParty = 'supplier' | 'customer'

export interface MoneyInput {
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  date: string
  key: string
}

/**
 * Records a supplier payment or a customer collection. Balances, ledgers, dashboards and reports all derive
 * from these rows, so a success invalidates all of them.
 */
export function useMoneyMutation(party: MoneyParty, partyId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: MoneyInput) =>
      party === 'supplier'
        ? paymentsApi.recordSupplierPayment(partyId, { amount: v.amount, paymentMethod: v.method, reference: v.reference, notes: v.notes, date: v.date }, v.key)
        : paymentsApi.recordCustomerPayment(partyId, { paymentDate: v.date, amount: v.amount, paymentMethod: v.method, notes: v.notes }, v.key),
    onSuccess: () => {
      for (const root of ['suppliers', 'customers', 'reports']) queryClient.invalidateQueries({ queryKey: [root] })
    }
  })
}
