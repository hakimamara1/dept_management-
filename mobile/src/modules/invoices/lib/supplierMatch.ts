// The AI reads a supplier name off a photo; this only *suggests* a known supplier. It is never applied silently —
// the desktop's rule is that a misread name must not create or pick a supplier on its own (see business-rules).

import { normalizeName } from '@/shared/lib/normalizeName'

const STOPWORDS = new Set([
  'شركة', 'مؤسسة', 'مورد', 'المورد', 'محلات', 'محل', 'ش', 'م', 'sarl', 'eurl', 'spa', 'sa', 'ets', 'ste', 'societe', 'entreprise'
])

function tokens(input: string): string[] {
  return normalizeName(input)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

function score(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const common = a.filter((w) => setB.has(w)).length
  if (common === 0) return 0
  const union = new Set([...a, ...b]).size
  const jaccard = common / union
  const containment = common / Math.min(a.length, b.length)
  return Math.max(jaccard, containment * 0.9)
}

/** The single best supplier for the read name, or null when nothing is close enough / two are equally close. */
export function suggestSupplier<T extends { id: number; name: string }>(readName: string | null | undefined, suppliers: T[]): T | null {
  if (!readName) return null
  const a = tokens(readName)
  const ranked = suppliers
    .map((s) => ({ s, score: score(a, tokens(s.name)) }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
  const best = ranked[0]
  if (!best || best.score < 0.7) return null
  if (ranked[1] && ranked[1].score > best.score - 0.15) return null // ambiguous — better to ask
  return best.s
}
