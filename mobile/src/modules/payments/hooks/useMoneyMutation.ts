import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AdjustBalanceInput, PaymentMethod } from '@/modules/payments/types'
import { paymentsApi } from '../services/payments.api'

export type MoneyParty = 'supplier' | 'customer'
export type MoneyAction = 'payment' | 'adjust'

export interface MoneyInput {
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  reason?: string
  date: string
  key: string
}

/**
 * One mutation for all four money actions (supplier/customer × payment/adjust). Balances, ledgers,
 * dashboards and reports all derive from these rows, so a success invalidates all of them.
 */
export function useMoneyMutation(party: MoneyParty, action: MoneyAction, partyId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: MoneyInput) => {
      if (action === 'adjust') {
        const data: AdjustBalanceInput = { amount: v.amount, reason: v.reason ?? '' }
        return party === 'supplier' ? paymentsApi.adjustSupplier(partyId, data, v.key) : paymentsApi.adjustCustomer(partyId, data, v.key)
      }
      return party === 'supplier'
        ? paymentsApi.recordSupplierPayment(partyId, { amount: v.amount, paymentMethod: v.method, reference: v.reference, notes: v.notes, date: v.date }, v.key)
        : paymentsApi.recordCustomerPayment(partyId, { paymentDate: v.date, amount: v.amount, paymentMethod: v.method, notes: v.notes }, v.key)
    },
    onSuccess: () => {
      for (const root of ['suppliers', 'customers', 'reports']) queryClient.invalidateQueries({ queryKey: [root] })
    }
  })
}
