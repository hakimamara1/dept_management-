import { useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { AppText, ListRow, TextField } from '@/shared/components/ui'
import { FormSheet } from '@/shared/components/FormSheet'
import { LoadingBlock } from '@/shared/components/states'
import { useI18n } from '@/shared/i18n/useI18n'
import { useDebounced } from '@/shared/lib/useDebounced'
import { suppliersApi } from '@/modules/suppliers/services/suppliers.api'

/** Pick the real supplier for a scanned invoice (the AI-read name is only a hint, never trusted to match). */
export function SupplierSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (supplierId: number) => void }) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())
  const suppliers = useQuery({ queryKey: ['suppliers', 'list', q], queryFn: () => suppliersApi.list(q), enabled: visible })

  return (
    <FormSheet visible={visible} title={t('scan.chooseSupplier')} onClose={onClose}>
      <TextField value={text} onChangeText={setText} placeholder={t('common.search')} />
      {suppliers.isLoading ? <LoadingBlock /> : (
        <View style={{ marginHorizontal: -16 }}>
          {(suppliers.data ?? []).length === 0 && <AppText variant="muted" style={{ padding: 16 }}>{t('common.noResults')}</AppText>}
          {(suppliers.data ?? []).map((s) => (
            <ListRow key={s.id} title={s.name} onPress={() => { onPick(s.id); onClose() }} />
          ))}
        </View>
      )}
    </FormSheet>
  )
}
