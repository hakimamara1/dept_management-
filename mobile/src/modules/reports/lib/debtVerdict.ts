// Port of desktop/src/modules/reports/lib/debtVerdict.ts — same thresholds and logic. The Arabic sentences are
// identical to the desktop's; French and English are added so the phone follows the app language.
import { formatCurrency } from '@/shared/lib/format'
import type { DebtAnalysis } from '@desktop-types/api'

export type VerdictStatus = 'down' | 'up' | 'stable'
export type VerdictLanguage = 'ar' | 'fr' | 'en'

export interface DebtDriver {
  key: 'purchases' | 'payments' | 'adjustments'
  label: string
  value: number
}

export interface DebtVerdict {
  status: VerdictStatus
  title: string
  lines: string[]
  drivers: DebtDriver[]
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`

interface Words {
  purchases: string
  payments: string
  debt: string
  purchasesShort: string
  paidShort: string
}

/** Everything language-specific lives here; the decision logic below is shared. */
interface Phrases {
  words: (isSuppliers: boolean) => Words
  adjustments: string
  subject: (name: string) => string
  title: (status: VerdictStatus, isSuppliers: boolean) => string
  noActivity: (w: Words, subject: string, ending: string) => string
  changed: (w: Words, subject: string, status: VerdictStatus, isSuppliers: boolean, amount: string, pct: string, from: string, to: string) => string
  dominantAdjustments: (isSuppliers: boolean, value: string) => string
  dominantPurchases: (w: Words, value: string) => string
  dominantPayments: (w: Words, value: string) => string
  ratioHigh: (w: Words, ratio: number) => string
  ratioLow: (w: Words, ratio: number, isSuppliers: boolean) => string
  onlyPayments: (w: Words, isSuppliers: boolean, amount: string) => string
  noPrevious: string
  better: (prev: string) => string
  worse: (prev: string) => string
  same: string
}

const AR: Phrases = {
  words: (s) =>
    s
      ? { purchases: 'مشتريات جديدة', payments: 'دفعات للموردين', debt: 'الدين', purchasesShort: 'اشتريت', paidShort: 'سددت' }
      : { purchases: 'مبيعات جديدة', payments: 'تحصيلات من العملاء', debt: 'ديون العملاء', purchasesShort: 'بعت', paidShort: 'حصّلت' },
  adjustments: 'تسويات يدوية',
  subject: (n) => ` «${n}»`,
  title: (status, s) =>
    status === 'down'
      ? s ? '🟢 الدين ينخفض — أنت على الطريق الصحيح' : '🟢 ديون العملاء تنخفض — التحصيل يسير جيداً'
      : status === 'up'
        ? s ? '🔴 الدين يرتفع — ديونك تحتاج انتباهاً' : '🔴 ديون العملاء ترتفع — راجع التحصيل'
        : s ? '🟡 الدين مستقر تقريباً' : '🟡 ديون العملاء مستقرة تقريباً',
  noActivity: (w, subject, ending) => `لا توجد حركات${subject} في هذه الفترة، فبقي ${w.debt} ثابتاً عند ${ending}.`,
  changed: (w, subject, status, s, amount, pct, from, to) => {
    const verb = s
      ? status === 'stable' ? 'تغيّر قليلاً' : status === 'up' ? 'ارتفع' : 'انخفض'
      : status === 'stable' ? 'تغيّرت قليلاً' : status === 'up' ? 'ارتفعت' : 'انخفضت'
    return `${w.debt}${subject} ${verb} بمقدار ${amount}${pct}: من ${from} إلى ${to}.`
  },
  dominantAdjustments: (s, v) => `السبب الرئيسي: تسويات يدوية بقيمة ${v} — وليس ${s ? 'مشتريات أو دفعات فعلية' : 'مبيعات أو تحصيلات فعلية'}.`,
  dominantPurchases: (w, v) => `السبب الرئيسي: ${w.purchases} بقيمة ${v}.`,
  dominantPayments: (w, v) => `السبب الرئيسي: ${w.payments} بقيمة ${v}.`,
  ratioHigh: (w, r) => `${w.paidShort} ${r}% مما ${w.purchasesShort} — أي أكثر من نشاط الفترة.`,
  ratioLow: (w, r) => `${w.paidShort} ${r}% فقط مما ${w.purchasesShort} — الباقي يُضاف إلى الدين.`,
  onlyPayments: (w, s, amount) => `لا توجد ${w.purchases} في الفترة، وتم ${s ? 'تسديد' : 'تحصيل'} ${amount}.`,
  noPrevious: 'لا توجد حركات في الفترة السابقة للمقارنة معها.',
  better: (prev) => `أفضل من الفترة السابقة (التغير السابق: ${prev}).`,
  worse: (prev) => `أسوأ من الفترة السابقة (التغير السابق: ${prev}).`,
  same: 'نفس أداء الفترة السابقة.'
}

const FR: Phrases = {
  words: (s) =>
    s
      ? { purchases: 'nouveaux achats', payments: 'paiements aux fournisseurs', debt: 'La dette', purchasesShort: 'acheté', paidShort: 'payé' }
      : { purchases: 'nouvelles ventes', payments: 'encaissements clients', debt: 'Les créances clients', purchasesShort: 'vendu', paidShort: 'encaissé' },
  adjustments: 'ajustements manuels',
  subject: (n) => ` « ${n} »`,
  title: (status, s) =>
    status === 'down'
      ? s ? '🟢 La dette baisse — vous êtes sur la bonne voie' : "🟢 Les créances baissent — l'encaissement se passe bien"
      : status === 'up'
        ? s ? '🔴 La dette augmente — elle demande votre attention' : "🔴 Les créances augmentent — vérifiez l'encaissement"
        : s ? '🟡 La dette est à peu près stable' : '🟡 Les créances sont à peu près stables',
  noActivity: (w, subject, ending) => `Aucun mouvement${subject} sur cette période : ${w.debt.charAt(0).toLowerCase()}${w.debt.slice(1)} reste à ${ending}.`,
  changed: (w, subject, status, s, amount, pct, from, to) => {
    const verb = s
      ? status === 'stable' ? 'varie légèrement' : status === 'up' ? 'a augmenté' : 'a diminué'
      : status === 'stable' ? 'varient légèrement' : status === 'up' ? 'ont augmenté' : 'ont diminué'
    return `${w.debt}${subject} ${verb} de ${amount}${pct} : de ${from} à ${to}.`
  },
  dominantAdjustments: (s, v) => `Cause principale : des ajustements manuels de ${v} — et non de vrais ${s ? 'achats ou paiements' : 'ventes ou encaissements'}.`,
  dominantPurchases: (w, v) => `Cause principale : ${w.purchases} pour ${v}.`,
  dominantPayments: (w, v) => `Cause principale : ${w.payments} pour ${v}.`,
  ratioHigh: (w, r) => `Vous avez ${w.paidShort} ${r} % de ce que vous avez ${w.purchasesShort} — plus que l'activité de la période.`,
  ratioLow: (w, r, s) => `Vous n'avez ${w.paidShort} que ${r} % de ce que vous avez ${w.purchasesShort} — le reste s'ajoute ${s ? 'à la dette' : 'aux créances'}.`,
  onlyPayments: (w, s, amount) => `Aucun nouvel achat ou vente sur la période ; ${s ? 'réglé' : 'encaissé'} : ${amount}.`,
  noPrevious: 'Aucun mouvement sur la période précédente à comparer.',
  better: (prev) => `Mieux que la période précédente (variation précédente : ${prev}).`,
  worse: (prev) => `Moins bien que la période précédente (variation précédente : ${prev}).`,
  same: 'Même résultat que la période précédente.'
}

const EN: Phrases = {
  words: (s) =>
    s
      ? { purchases: 'new purchases', payments: 'payments to suppliers', debt: 'Debt', purchasesShort: 'bought', paidShort: 'paid' }
      : { purchases: 'new sales', payments: 'customer collections', debt: 'Customer debt', purchasesShort: 'sold', paidShort: 'collected' },
  adjustments: 'manual adjustments',
  subject: (n) => ` “${n}”`,
  title: (status, s) =>
    status === 'down'
      ? s ? '🟢 Debt is falling — you are on the right track' : '🟢 Customer debt is falling — collection is going well'
      : status === 'up'
        ? s ? '🔴 Debt is rising — it needs your attention' : '🔴 Customer debt is rising — review collection'
        : s ? '🟡 Debt is roughly stable' : '🟡 Customer debt is roughly stable',
  noActivity: (w, subject, ending) => `No movements${subject} in this period, so ${w.debt.toLowerCase()} stayed at ${ending}.`,
  changed: (w, subject, status, _s, amount, pct, from, to) => {
    const verb = status === 'stable' ? 'changed slightly' : status === 'up' ? 'rose' : 'fell'
    return `${w.debt}${subject} ${verb} by ${amount}${pct}: from ${from} to ${to}.`
  },
  dominantAdjustments: (s, v) => `Main reason: manual adjustments of ${v} — not real ${s ? 'purchases or payments' : 'sales or collections'}.`,
  dominantPurchases: (w, v) => `Main reason: ${w.purchases} worth ${v}.`,
  dominantPayments: (w, v) => `Main reason: ${w.payments} worth ${v}.`,
  ratioHigh: (w, r) => `You ${w.paidShort} ${r}% of what you ${w.purchasesShort} — more than the period's activity.`,
  ratioLow: (w, r, s) => `You ${w.paidShort} only ${r}% of what you ${w.purchasesShort} — the rest is added to ${s ? 'the debt' : 'customer debt'}.`,
  onlyPayments: (w, s, amount) => `No ${w.purchases} in the period, and ${amount} was ${s ? 'paid' : 'collected'}.`,
  noPrevious: 'No movements in the previous period to compare with.',
  better: (prev) => `Better than the previous period (previous change: ${prev}).`,
  worse: (prev) => `Worse than the previous period (previous change: ${prev}).`,
  same: 'Same result as the previous period.'
}

const PHRASES: Record<VerdictLanguage, Phrases> = { ar: AR, fr: FR, en: EN }

export function buildVerdict(a: DebtAnalysis, language: VerdictLanguage = 'ar'): DebtVerdict {
  const P = PHRASES[language]
  const isSuppliers = a.scope === 'suppliers'
  const { current: c, previous: p } = a
  const words = P.words(isSuppliers)
  const subject = a.entity ? P.subject(a.entity.name) : ''

  const level = Math.max(Math.abs(c.beginning), Math.abs(c.ending))
  const status: VerdictStatus = c.change === 0 || Math.abs(c.change) < level * 0.01 ? 'stable' : c.change < 0 ? 'down' : 'up'

  const drivers: DebtDriver[] = [
    { key: 'purchases', label: words.purchases, value: c.purchases },
    { key: 'payments', label: words.payments, value: -c.payments },
    { key: 'adjustments', label: P.adjustments, value: c.adjustments }
  ]

  const lines: string[] = []
  const noActivity = c.purchases === 0 && c.payments === 0 && c.adjustments === 0

  if (noActivity) {
    lines.push(P.noActivity(words, subject, formatCurrency(c.ending)))
  } else {
    const pct = c.changePercent == null ? '' : ` (${Math.abs(c.changePercent)}%)`
    lines.push(P.changed(words, subject, status, isSuppliers, formatCurrency(Math.abs(c.change)), pct, formatCurrency(c.beginning), formatCurrency(c.ending)))

    const dominant = [...drivers].filter((d) => d.value !== 0).sort((x, y) => Math.abs(y.value) - Math.abs(x.value))[0]
    if (dominant) {
      if (dominant.key === 'adjustments') lines.push(P.dominantAdjustments(isSuppliers, signed(dominant.value)))
      else if (dominant.key === 'purchases') lines.push(P.dominantPurchases(words, formatCurrency(dominant.value)))
      else lines.push(P.dominantPayments(words, formatCurrency(Math.abs(dominant.value))))
    }

    if (c.paymentRatio != null) {
      lines.push(c.paymentRatio >= 100 ? P.ratioHigh(words, c.paymentRatio) : P.ratioLow(words, c.paymentRatio, isSuppliers))
    } else if (c.payments > 0) {
      lines.push(P.onlyPayments(words, isSuppliers, formatCurrency(c.payments)))
    }
  }

  const prevActive = p.purchases !== 0 || p.payments !== 0 || p.adjustments !== 0
  if (!prevActive) lines.push(P.noPrevious)
  else if (c.change < p.change) lines.push(P.better(signed(p.change)))
  else if (c.change > p.change) lines.push(P.worse(signed(p.change)))
  else lines.push(P.same)

  return { status, title: P.title(status, isSuppliers), lines, drivers }
}
