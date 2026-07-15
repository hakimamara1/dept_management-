import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    /** Human-readable label used in the column-visibility menu and CSV export header. */
    exportLabel?: string
  }
}
