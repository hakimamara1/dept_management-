import { PageHeader } from '@shared/components/PageHeader'
import { useI18n } from '@shared/lib/i18n'
import { ProductsTable } from '../components/ProductsTable'
import { CreateProductDialog } from '../components/CreateProductDialog'

export function ProductsPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        actions={<CreateProductDialog />}
      />
      <ProductsTable />
    </div>
  )
}
