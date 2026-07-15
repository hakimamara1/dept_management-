import { useState, type ReactNode } from 'react'
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Columns3, Download } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { LoadingState } from '@shared/components/LoadingState'
import { EmptyState } from '@shared/components/EmptyState'
import { Inbox } from 'lucide-react'
import { cn } from '@shared/lib/utils'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  /** Extra controls rendered at the start of the toolbar (e.g. a search input owned by the caller). */
  toolbar?: ReactNode
  enableRowSelection?: boolean
  onRowSelectionChange?: (selected: TData[]) => void
  getRowId?: (row: TData) => string
  pageSize?: number
  exportFileName?: string
}

/**
 * The single reusable TanStack Table wrapper every module's list view
 * builds on — sorting, column visibility, sticky header, pagination, CSV
 * export and optional row selection all live here once instead of being
 * re-implemented per module.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  toolbar,
  enableRowSelection = false,
  onRowSelectionChange,
  getRowId,
  pageSize = 10,
  exportFileName = 'export'
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater)
      if (onRowSelectionChange) {
        const next = typeof updater === 'function' ? updater(rowSelection) : updater
        const selectedRows = table
          .getCoreRowModel()
          .rows.filter((r) => next[r.id])
          .map((r) => r.original)
        onRowSelectionChange(selectedRows)
      }
    },
    getRowId: getRowId as ((row: TData) => string) | undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } }
  })

  function exportCsv() {
    const visibleColumns = table.getVisibleLeafColumns().filter((c) => c.id !== 'select')
    const header = visibleColumns.map((c) => String(c.columnDef.meta?.exportLabel ?? c.id)).join(',')
    const rows = table
      .getFilteredRowModel()
      .rows.map((row) =>
        visibleColumns
          .map((c) => {
            const value = row.getValue(c.id)
            const cell = value == null ? '' : String(value).replace(/"/g, '""')
            return `"${cell}"`
          })
          .join(',')
      )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportFileName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">{toolbar}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data.length}>
            <Download className="size-3.5" />
            تصدير CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-3.5" />
                الأعمدة
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>إظهار/إخفاء الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {String(column.columnDef.meta?.exportLabel ?? column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="h-10 px-3 text-start align-middle">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-3">
                  <LoadingState rows={5} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-muted/50',
                    row.getIsSelected() && 'bg-accent/60'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {table.getFilteredRowModel().rows.length} عنصر
            {enableRowSelection && table.getFilteredSelectedRowModel().rows.length > 0
              ? ` — تم تحديد ${table.getFilteredSelectedRowModel().rows.length}`
              : ''}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              صفحة {table.getState().pagination.pageIndex + 1} من {table.getPageCount() || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
