import { useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { Product } from '@desktop-types/api'
import { ListRow, TextField } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { useDebounced } from '@/shared/lib/useDebounced'
import { salesInvoicesApi } from '../services/salesInvoices.api'

/**
 * Free-text name with catalogue suggestions. Sales lines are free text by design (no link to the
 * purchasing catalogue); picking a suggestion only prefills unit and price, never replaces what you typed.
 */
export function ProductSearchField({ value, onChangeText, onPick }: { value: string; onChangeText: (v: string) => void; onPick: (p: Product) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const q = useDebounced(value.trim(), 250)
  const results = useQuery({
    queryKey: ['product-search', q],
    queryFn: () => salesInvoicesApi.searchProducts(q),
    enabled: open && q.length > 0
  })

  return (
    <View style={{ gap: 4 }}>
      <TextField
        value={value}
        onChangeText={(v) => { onChangeText(v); setOpen(true) }}
        placeholder={t('invoice.itemName')}
      />
      {open && q.length > 0 && (results.data?.length ?? 0) > 0 && (
        <View style={{ maxHeight: 200, borderRadius: 8, overflow: 'hidden' }}>
          {results.data!.slice(0, 6).map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={[p.unit, p.default_sale_price != null ? String(p.default_sale_price) : null].filter(Boolean).join(' · ')}
              onPress={() => { onPick(p); setOpen(false) }}
            />
          ))}
        </View>
      )}
    </View>
  )
}
