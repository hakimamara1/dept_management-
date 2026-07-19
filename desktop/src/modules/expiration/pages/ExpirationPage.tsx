import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Ban, CheckCircle2, Clock, Printer, Search, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { DataTable } from '@shared/components/data-table/DataTable'
import { DataTableColumnHeader } from '@shared/components/data-table/DataTableColumnHeader'
import { PageHeader } from '@shared/components/PageHeader'
import { StatCard } from '@shared/components/StatCard'
import { ProductPicker } from '@shared/components/ProductPicker'
import { formatDate } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import type { ExpirationBatch, ExpirationBatchStatus } from '@shared/types/api'
import { useExpirationBatches, useExpirationDashboard } from '../hooks/useExpirationBatches'
import { useDiscardedReport, useExpiredReport, useExpiringReport } from '../hooks/useExpirationReports'
import { useDeleteExpirationBatch } from '../hooks/useExpirationMutations'
import { CreateBatchDialog } from '../components/CreateBatchDialog'
import { BatchStatusBadge } from '../components/BatchStatusBadge'

type SubTab = 'dashboard' | 'batches' | 'reports'
type ReportTab = 'expiring7' | 'expiring30' | 'expired' | 'discarded'

const STATUS_OPTIONS: { value: ExpirationBatchStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'نشطة' },
  { value: 'NEAR_EXPIRY', label: 'قريبة الانتهاء' },
  { value: 'EXPIRED', label: 'منتهية الصلاحية' },
  { value: 'DISCARDED', label: 'تم إتلافها' },
  { value: 'SOLD', label: 'مباعة' }
]

function batchColumns(onView: (id: number) => void, onDelete: (id: number) => void): ColumnDef<ExpirationBatch, any>[] {
  return [
    { accessorKey: 'product_name', header: 'المنتج', meta: { exportLabel: 'المنتج' } },
    { accessorKey: 'batch_number', header: 'رقم الدفعة', meta: { exportLabel: 'رقم الدفعة' } },
    {
      accessorKey: 'quantity',
      header: 'الكمية',
      meta: { exportLabel: 'الكمية' },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.quantity ?? '—'} {row.original.unit ?? row.original.product_unit ?? ''}
        </span>
      )
    },
    {
      accessorKey: 'manufacturing_date',
      header: 'تاريخ التصنيع',
      meta: { exportLabel: 'تاريخ التصنيع' },
      cell: ({ row }) => formatDate(row.original.manufacturing_date)
    },
    {
      accessorKey: 'expiration_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="تاريخ الانتهاء" />,
      meta: { exportLabel: 'تاريخ الانتهاء' },
      cell: ({ row }) => formatDate(row.original.expiration_date)
    },
    {
      accessorKey: 'days_remaining',
      header: ({ column }) => <DataTableColumnHeader column={column} title="الأيام المتبقية" />,
      meta: { exportLabel: 'الأيام المتبقية' },
      cell: ({ row }) => (
        <span className={cn('tabular-nums font-semibold', row.original.days_remaining < 0 && 'text-destructive')}>
          {row.original.days_remaining}
        </span>
      )
    },
    {
      accessorKey: 'computed_status',
      header: 'الحالة',
      meta: { exportLabel: 'الحالة' },
      cell: ({ row }) => <BatchStatusBadge status={row.original.computed_status} />
    },
    { accessorKey: 'location', header: 'الموقع', meta: { exportLabel: 'الموقع' }, cell: ({ row }) => row.original.location ?? '—' },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onView(row.original.id)}>
            عرض
          </Button>
          <Button type="button" size="icon" variant="ghost" title="حذف" onClick={() => onDelete(row.original.id)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      )
    }
  ]
}

function ReportTable({ data, isLoading, fileName }: { data: ExpirationBatch[] | undefined; isLoading: boolean; fileName: string }) {
  const columns = batchColumns(() => {}, () => {})
  // Reports are read-only views — drop the delete/view action column.
  const readOnlyColumns = columns.filter((c) => c.id !== 'actions')
  return (
    <div className="space-y-3">
      <div className="flex justify-end print:hidden">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          طباعة
        </Button>
      </div>
      <DataTable columns={readOnlyColumns} data={data ?? []} isLoading={isLoading} exportFileName={fileName} />
    </div>
  )
}

export function ExpirationPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<SubTab>('dashboard')
  const [reportTab, setReportTab] = useState<ReportTab>('expiring7')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ExpirationBatchStatus | ''>('')
  const [category, setCategory] = useState('')
  const [product, setProduct] = useState<{ id: number; name: string } | null>(null)

  const dashboard = useExpirationDashboard()
  const batches = useExpirationBatches({
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    productId: product?.id
  })
  const deleteBatch = useDeleteExpirationBatch()

  const expiring7 = useExpiringReport(7)
  const expiring30 = useExpiringReport(30)
  const expired = useExpiredReport()
  const discarded = useDiscardedReport()

  function handleDelete(id: number) {
    if (!window.confirm('حذف هذه الدفعة نهائياً؟')) return
    deleteBatch.mutate(id)
  }

  function handleView(id: number) {
    navigate(`/expiration/${id}`)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="تتبع الصلاحية"
        subtitle="تسجيل يدوي لدفعات المنتجات وتواريخ انتهاء صلاحيتها — مستقل تماماً عن المخزون والحسابات"
        actions={tab === 'batches' ? <CreateBatchDialog /> : undefined}
      />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('dashboard')}>
          لوحة القيادة
        </Button>
        <Button variant={tab === 'batches' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('batches')}>
          الدفعات
        </Button>
        <Button variant={tab === 'reports' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('reports')}>
          التقارير
        </Button>
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={CheckCircle2} label="الدفعات النشطة" value={String(dashboard.data?.active_count ?? 0)} loading={dashboard.isLoading} />
            <StatCard icon={Clock} label="تنتهي خلال 30 يوماً" value={String(dashboard.data?.near_expiry_count ?? 0)} loading={dashboard.isLoading} />
            <StatCard icon={AlertTriangle} label="منتهية الصلاحية" value={String(dashboard.data?.expired_count ?? 0)} loading={dashboard.isLoading} />
            <StatCard icon={Ban} label="تم إتلافها" value={String(dashboard.data?.discarded_count ?? 0)} loading={dashboard.isLoading} />
          </div>

          <div className="rounded-lg border border-border p-5">
            <div className="mb-3 text-sm font-medium">دفعات على وشك الانتهاء</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{dashboard.data?.expiring_today_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">تنتهي اليوم</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{dashboard.data?.expiring_this_week_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">تنتهي هذا الأسبوع</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{dashboard.data?.expiring_this_month_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">تنتهي هذا الشهر</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <DataTable
          columns={batchColumns(handleView, handleDelete)}
          data={batches.data ?? []}
          isLoading={batches.isLoading}
          exportFileName="expiration-batches"
          getRowId={(row) => String(row.id)}
          emptyTitle="لا توجد دفعات"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الباركود أو رقم الدفعة..."
                  className="ps-8 h-9"
                />
              </div>
              <div className="w-48">
                <ProductPicker value={product} onChange={setProduct} placeholder="تصفية حسب المنتج..." />
              </div>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="الفئة..."
                className="h-9 w-32"
              />
              <Select value={status || 'ALL'} onValueChange={(v) => setStatus(v === 'ALL' ? '' : (v as ExpirationBatchStatus))}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">كل الحالات</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Button variant={reportTab === 'expiring7' ? 'default' : 'ghost'} size="sm" onClick={() => setReportTab('expiring7')}>
              تنتهي خلال 7 أيام
            </Button>
            <Button variant={reportTab === 'expiring30' ? 'default' : 'ghost'} size="sm" onClick={() => setReportTab('expiring30')}>
              تنتهي خلال 30 يوماً
            </Button>
            <Button variant={reportTab === 'expired' ? 'default' : 'ghost'} size="sm" onClick={() => setReportTab('expired')}>
              منتهية الصلاحية
            </Button>
            <Button variant={reportTab === 'discarded' ? 'default' : 'ghost'} size="sm" onClick={() => setReportTab('discarded')}>
              تم إتلافها
            </Button>
          </div>

          {reportTab === 'expiring7' && <ReportTable data={expiring7.data} isLoading={expiring7.isLoading} fileName="expiring-7-days" />}
          {reportTab === 'expiring30' && <ReportTable data={expiring30.data} isLoading={expiring30.isLoading} fileName="expiring-30-days" />}
          {reportTab === 'expired' && <ReportTable data={expired.data} isLoading={expired.isLoading} fileName="expired-batches" />}
          {reportTab === 'discarded' && <ReportTable data={discarded.data} isLoading={discarded.isLoading} fileName="discarded-batches" />}
        </div>
      )}
    </div>
  )
}
