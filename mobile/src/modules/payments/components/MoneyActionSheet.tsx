import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { ApiError, newIdempotencyKey } from '@/shared/api/client'
import { AppButton, AppText, Card, Segmented, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { useI18n } from '@/shared/i18n/useI18n'
import { errorText } from '@/shared/lib/errorMessage'
import { formatCurrency } from '@/shared/lib/format'
import { parseNumber, todayISO } from '@/shared/lib/numbers'
import { toast } from '@/shared/lib/toast'
import { useTheme } from '@/shared/theme/useTheme'
import { useMoneyMutation, type MoneyParty } from '../hooks/useMoneyMutation'
import type { PaymentMethod } from '../types'

interface Props {
  visible: boolean
  onClose: () => void
  party: MoneyParty
  partyId: number
  partyName: string
  /** What the party owes right now — used to show the resulting balance and cap supplier payments. */
  currentBalance: number
}

/**
 * Two steps on purpose: fill in → review the resulting balance → confirm. A fresh idempotency key is
 * minted each time the user reaches the review step, so a retry of the *same* review replays safely
 * while an edited amount can never be mistaken for an earlier attempt.
 */
export function MoneyActionSheet({ visible, onClose, party, partyId, partyName, currentBalance }: Props) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const mutation = useMoneyMutation(party, partyId)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [amountText, setAmountText] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState('')

  useEffect(() => {
    if (visible) {
      setStep('form'); setAmountText(''); setMethod('cash'); setNote(''); setError(null)
    }
  }, [visible])

  const magnitude = parseNumber(amountText)
  // A payment always lowers what is owed.
  const delta = -magnitude
  const newBalance = currentBalance + delta
  const title = t('money.recordPayment')

  function review() {
    if (!Number.isFinite(magnitude) || magnitude <= 0) return setError(t('money.errorAmount'))
    if (party === 'supplier' && magnitude > currentBalance + 0.001) return setError(t('money.errorExceeds'))
    setError(null)
    setKey(newIdempotencyKey())
    setStep('review')
  }

  function submit() {
    mutation.mutate(
      { amount: magnitude, method, reference: undefined, notes: note.trim() || undefined, date: todayISO(), key },
      {
        onSuccess: () => { toast(t('money.done')); onClose() },
        onError: (e) => {
          // The server may have applied the payment even though we never saw the answer, so after a
          // network failure the user stays on this review step and retries with the SAME key (replay,
          // never a second payment). Only a definitive rejection sends them back to edit.
          const unsure = e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')
          setError(unsure ? t('money.errorNetwork') : errorText(e, t))
          if (!unsure) setStep('form')
        }
      }
    )
  }

  return (
    <FormSheet visible={visible} title={`${title} — ${partyName}`} onClose={onClose}>
      {step === 'form' ? (
        <>
          <AppText variant="caption">{t('suppliers.balance')}: {formatCurrency(currentBalance)}</AppText>
          <TextField value={amountText} onChangeText={setAmountText} placeholder={t('money.amount')} keyboardType="decimal-pad" />
          <Segmented<PaymentMethod>
            value={method}
            onChange={setMethod}
            options={[{ value: 'cash', label: t('money.cash') }, { value: 'bank_transfer', label: t('money.bank') }, { value: 'check', label: t('money.check') }]}
          />
          <TextField value={note} onChangeText={setNote} placeholder={t('money.notes')} />
          {error && <AppText style={{ color: colors.destructive }} accessibilityRole="alert">{error}</AppText>}
          <AppButton label={t('money.review')} onPress={review} />
        </>
      ) : (
        <>
          <Card>
            <AppText variant="muted">{t('suppliers.balance')}</AppText>
            <AppText variant="body">{formatCurrency(currentBalance)}</AppText>
            <AppText variant="muted">{delta < 0 ? t('money.decrease') : t('money.increase')}</AppText>
            <AppText variant="heading" style={{ color: delta < 0 ? colors.success : colors.destructive }}>
              {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}
            </AppText>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <AppText variant="muted">{t('money.newBalance')}</AppText>
            <AppText variant="title">{formatCurrency(newBalance)}</AppText>
          </Card>
          {error && <AppText style={{ color: colors.destructive }} accessibilityRole="alert">{error}</AppText>}
          <AppButton label={t('money.confirm')} onPress={submit} loading={mutation.isPending} />
          <AppButton variant="ghost" label={t('money.back')} onPress={() => setStep('form')} disabled={mutation.isPending} />
        </>
      )}
    </FormSheet>
  )
}
