// Mirrors src/models/schema.sql and the JSON shapes returned by src/routes/*.js.
// Kept hand-written rather than generated — the backend has no OpenAPI/schema
// export yet; if one is added later this file becomes a generation target.

export type ProductUnit = 'piece' | 'kg' | 'box' | 'liter' | 'g'

export interface Product {
  id: number
  name: string
  barcode: string | null
  category: string | null
  unit: ProductUnit | string | null
  current_stock: number | null
  last_purchase_price: number | null
  average_cost: number | null
  default_sale_price: number | null
  created_at: string
}

// Catalog fields only — cost values (last_purchase_price/average_cost) stay
// system-computed from approved invoices, default_sale_price has its own
// dedicated endpoint (PATCH /:id/price).
export interface UpdateProductInput {
  name?: string
  barcode?: string | null
  category?: string | null
  unit?: string
}

export interface PriceHistoryPoint {
  date: string
  price: number
  quantity: number
  supplier: string | null
  invoiceNumber: string
}

export interface PriceHistoryStats {
  count: number
  min: number
  max: number
  avg: number
  first: number
  last: number
  changeAbs: number
  changePct: number
  trend: 'up' | 'down' | 'flat'
}

export interface PriceHistoryResponse {
  product: { id: number; name: string; unit: string | null }
  points: PriceHistoryPoint[]
  stats: PriceHistoryStats | null
}

export interface DashboardStats {
  pending_invoices: number
  approved_invoices: number
  total_purchases: number
  total_debt: number
  total_products: number
  total_aliases: number
  total_stock_value: number
}

export interface PurchaseTrendPoint {
  month: string
  invoice_count: number
  total_amount: number
  total_discount: number
}

export interface LowStockProduct {
  id: number
  name: string
  category: string | null
  unit: string | null
  current_stock: number
}

export interface PendingInvoice {
  id: number
  invoice_number: string
  invoice_date: string
  supplier_name: string
  invoice_amount: number
  total_items: number
  pending_items: number
  status: string
}

export interface SupplierAging {
  id: number
  name: string
  current_balance: number
  _0_30: number
  _30_60: number
  _60_90: number
  _90_plus: number
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  commercial_register: string | null
  current_balance: number
  created_at: string
}

export type SupplierTransactionType = 'invoice' | 'payment' | 'adjustment'

export interface SupplierTransaction {
  id: number
  supplier_id: number
  invoice_id: number | null
  transaction_type: SupplierTransactionType
  amount: number
  balance_after: number
  description: string | null
  created_at: string
  invoice_number: string | null
  invoice_date: string | null
  /** Only present on the cross-supplier /api/payments endpoint, not the per-supplier ledger. */
  supplier_name?: string
}

export interface RecordPaymentInput {
  amount: number
  paymentMethod: 'cash' | 'bank_transfer' | 'check'
  reference?: string
  notes?: string
  date?: string
}

export interface AdjustBalanceInput {
  amount: number
  reason: string
}

// ── Invoices ──────────────────────────────────────────────
export type InvoiceStatus = 'Pending Review' | 'Approved' | 'Rejected'
export type ItemMatchStatus = 'Pending' | 'Matched' | 'NewProduct' | 'UserSelected'

export interface ApprovedInvoice {
  id: number
  invoice_number: string
  invoice_date: string
  supplier_id: number
  supplier_name: string
  currency: string
  invoice_amount: number
  discount: number
  tax: number
  new_balance: number | null
  status: InvoiceStatus
  created_at: string
}

export interface InvoiceReviewHeader {
  id: number
  invoice_number: string
  invoice_date: string
  // Scanned invoices always start with no supplier set — the AI-extracted
  // name (ocr_supplier_name) is a hint only; the user must pick a real
  // supplier via SupplierPicker before the invoice can be approved.
  supplier_id: number | null
  supplier_name: string | null
  ocr_supplier_name: string | null
  current_balance: number | null
  currency: string
  previous_balance: number | null
  invoice_amount: number
  ocr_header_total: number | null
  discount: number
  tax: number
  new_balance: number | null
  status: InvoiceStatus
  validation_errors: string | null
  notes: string | null
  approved_at: string | null
  // 'ocr' (pasted OCR JSON) or 'manual' (typed in from a handwritten invoice)
  source: 'ocr' | 'manual'
}

export interface InvoiceAttachment {
  id: number
  invoice_id: number
  file_path: string
  original_name: string | null
  uploaded_at: string
}

export interface InvoiceReviewItem {
  id: number
  invoice_id: number
  product_id: number | null
  line_number: number
  ocr_product_name: string
  unit: string | null
  quantity: number
  unit_price: number
  total_price: number
  match_status: ItemMatchStatus
  match_confidence: number | null
  suggested_product_id: number | null
  suggested_product_name: string | null
  matched_product_name: string | null
}

export interface InvoiceReviewResponse {
  invoice: InvoiceReviewHeader
  items: InvoiceReviewItem[]
  attachments: InvoiceAttachment[]
}

// Only meaningful while the invoice is still Pending Review — the backend
// rejects all of these once it's Approved. productId resolves to an
// existing product; createNewProduct creates one on the spot. Omitting
// both just corrects name/quantity/unit/unitPrice without touching the match.
export interface NewProductInput {
  unit: string
}

export interface UpdateInvoiceItemInput {
  productName?: string
  quantity?: number
  unit?: string
  unitPrice?: number
  productId?: number
  createNewProduct?: NewProductInput
}

export interface AddInvoiceItemInput {
  productName: string
  quantity: number
  unit?: string
  unitPrice: number
  productId?: number
  createNewProduct?: NewProductInput
}

// For a supplier's handwritten invoice — no OCR JSON to paste, typed in
// directly. Every item requires either an existing productId (picked via
// ProductPicker) or createNewProduct — no OCR ambiguity to resolve later.
export interface CreateManualInvoiceItemInput {
  productName: string
  quantity: number
  unit?: string
  unitPrice: number
  productId?: number
  createNewProduct?: NewProductInput
}

export interface CreateManualInvoiceInput {
  supplierId: number
  invoiceNumber: string
  invoiceDate: string
  invoiceTime?: string
  currency?: string
  discount?: number
  tax?: number
  paymentMethod?: string
  notes?: string
  items: CreateManualInvoiceItemInput[]
}

// ── Purchase Orders ───────────────────────────────────────
export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'Received' | 'Cancelled'

export interface PurchaseOrder {
  id: number
  supplier_id: number
  supplier_name: string
  status: PurchaseOrderStatus
  order_date: string
  expected_date: string | null
  notes: string | null
  created_at: string
  item_count: number
  expected_total: number
}

export interface PurchaseOrderItem {
  id: number
  purchase_order_id: number
  product_id: number
  product_name: string
  unit: string | null
  quantity: number
  expected_unit_price: number | null
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  supplier_phone: string | null
  items: PurchaseOrderItem[]
}

export interface CreatePurchaseOrderInput {
  supplierId: number
  orderDate: string
  expectedDate?: string
  notes?: string
  items: { productId: number; quantity: number; expectedUnitPrice?: number }[]
}

// Editing is only ever accepted by the backend while status === 'Draft'.
export interface UpdatePurchaseOrderInput {
  supplierId?: number
  orderDate?: string
  expectedDate?: string
  notes?: string
}

export interface UpdatePurchaseOrderItemInput {
  productId?: number
  quantity?: number
  expectedUnitPrice?: number
}

export interface AddPurchaseOrderItemInput {
  productId: number
  quantity: number
  expectedUnitPrice?: number
}

// ── Accounting / Reports ──────────────────────────────────
export type AccountCode =
  | 'inventory'
  | 'accounts_payable'
  | 'purchases'
  | 'cash'
  | 'bank'
  | 'sales'
  | 'cogs'
  | 'discount_received'
  | 'tax_payable'

export interface TrialBalanceRow {
  account_code: AccountCode | string
  total_debit: number
  total_credit: number
  balance: number
}

export interface BalanceSheet {
  assets: number
  liabilities: number
  equity: number
  netWorth: number
}

export interface ProfitLoss {
  revenue: number
  cogs: number
  purchases: number
  grossProfit: number
  netPurchases: number
}

export interface BalanceVerification {
  balanced: boolean
  difference: number
  totalDebits: number
  totalCredits: number
}

// ── Wholesale Customers ───────────────────────────────────
// Independent domain: no FK to products/suppliers, no stock or accounting
// effects. Balance is never stored — always computed as
// SUM(sales_invoices) - SUM(customer_payments) by the backend.
export interface Customer {
  id: number
  full_name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  total_invoice_amount: number
  total_invoices: number
  total_payment_amount: number
  total_payments: number
  last_invoice_date: string | null
  last_payment_date: string | null
  current_balance: number
}

export interface CreateCustomerInput {
  fullName: string
  phone?: string
  address?: string
  notes?: string
}

export type SalesInvoiceStatus = 'Draft' | 'Final'

export interface SalesInvoiceListItem {
  id: number
  invoice_number: string
  customer_id: number
  invoice_date: string
  invoice_amount: number
  previous_balance: number
  new_balance: number
  notes: string | null
  status: SalesInvoiceStatus
  created_at: string
}

export interface SalesInvoiceItem {
  id: number
  invoice_id: number
  product_id: number | null
  product_name: string
  unit: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export interface SalesInvoiceDetail extends SalesInvoiceListItem {
  customer_name: string
  customer_phone: string | null
  items: SalesInvoiceItem[]
}

export interface CreateSalesInvoiceItemInput {
  productId?: number | null
  productName: string
  unit?: string
  quantity: number
  unitPrice: number
}

export interface CreateSalesInvoiceInput {
  invoiceDate: string
  notes?: string
  items: CreateSalesInvoiceItemInput[]
}

export interface UpdateSalesInvoiceItemInput {
  productName?: string
  unit?: string | null
  quantity?: number
  unitPrice?: number
}

export interface AddSalesInvoiceItemInput {
  productName: string
  unit?: string | null
  quantity: number
  unitPrice: number
}

export interface CustomerPayment {
  id: number
  customer_id: number
  payment_date: string
  amount: number
  payment_method: string | null
  notes: string | null
  created_at: string
}

export interface RecordCustomerPaymentInput {
  paymentDate: string
  amount: number
  paymentMethod?: string
  notes?: string
}

export interface CustomerStatementEntry {
  entry_type: 'invoice' | 'payment' | 'adjustment'
  entry_id: number
  entry_date: string
  reference: string | null
  amount: number
  balance: number
}

export interface CustomerReportsSummary {
  total_customers: number
  total_invoice_value: number
  total_payment_value: number
  total_customer_debt: number
  average_invoice_value: number
  largestDebtors: { id: number; full_name: string; balance: number }[]
  mostActive: { id: number; full_name: string; activity_count: number }[]
}

// ── Expiration Tracking ───────────────────────────────────
// Fully independent module — only ever references product_id. Never
// touches stock, purchase invoices, or supplier/customer accounting.
// ACTIVE/NEAR_EXPIRY/EXPIRED are always computed live from expiration_date
// (see business-rules.md) — DISCARDED/SOLD are the only two a user sets.
export type ExpirationBatchStatus = 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED' | 'DISCARDED' | 'SOLD'

export interface ExpirationBatch {
  id: number
  product_id: number
  batch_number: string
  manufacturing_date: string | null
  expiration_date: string
  quantity: number | null
  unit: string | null
  location: string | null
  status: ExpirationBatchStatus
  notes: string | null
  created_at: string
  updated_at: string
  product_name: string
  product_barcode: string | null
  product_category: string | null
  product_unit: string | null
  days_remaining: number
  computed_status: ExpirationBatchStatus
}

export interface ExpirationDashboardSummary {
  active_count: number
  near_expiry_count: number
  expired_count: number
  discarded_count: number
  expiring_today_count: number
  expiring_this_week_count: number
  expiring_this_month_count: number
}

export interface ExpirationBatchFilters {
  productId?: number
  category?: string
  status?: ExpirationBatchStatus
  expiringWithinDays?: number
  search?: string
}

export interface CreateExpirationBatchInput {
  productId: number
  batchNumber: string
  expirationDate: string
  manufacturingDate?: string
  quantity?: number
  unit?: string
  location?: string
  notes?: string
}

export interface UpdateExpirationBatchInput {
  batchNumber?: string
  manufacturingDate?: string
  expirationDate?: string
  quantity?: number
  unit?: string
  location?: string
  notes?: string
}

// ── Settings ──────────────────────────────────────────────
// Single-row table (id always 1) — business identity for print headers.
export interface BusinessProfile {
  id: 1
  business_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  tax_number: string | null
  commercial_register: string | null
  logo_path: string | null
  updated_at: string
}

export interface UpdateBusinessProfileInput {
  businessName?: string
  address?: string
  phone?: string
  email?: string
  taxNumber?: string
  commercialRegister?: string
}

// ── Dashboard analytics ──────────────────────────────────────
export type DashboardRange = 'today' | 'week' | 'month' | 'last_month' | '3months' | 'year' | 'custom'

export interface KpiComparison {
  value: number
  previousValue: number
  changePercent: number
  direction: 'up' | 'down' | 'flat'
}

export interface DashboardKpis {
  range: { startDate: string; endDate: string }
  totalDebt: KpiComparison
  totalPurchases: KpiComparison
  purchasesThisPeriod: KpiComparison
  paymentsThisPeriod: KpiComparison
  totalSuppliers: number
  suppliersWithOutstandingDebt: number
  averageInvoiceValue: KpiComparison
}

export interface DebtEvolutionPoint {
  date: string
  totalDebt: number
}

export interface DebtEvolutionResponse {
  granularity: 'day' | 'week' | 'month'
  points: DebtEvolutionPoint[]
}

export interface DebtBySupplierEntry {
  supplier: string
  debt: number
}

export interface PurchasePeriodEntry {
  period: string
  invoiceCount: number
  total: number
}

export interface LargestPurchaseInvoice {
  id: number
  invoice_number: string
  invoice_date: string
  invoice_amount: number
  supplier: string
}

export interface PurchaseBySupplierEntry {
  supplier: string
  total: number
  invoiceCount: number
}

export interface PurchaseAnalytics {
  granularity: 'day' | 'month'
  perPeriod: PurchasePeriodEntry[]
  largestInvoices: LargestPurchaseInvoice[]
  bySupplier: PurchaseBySupplierEntry[]
  averageInvoiceAmount: number
  totalInvoiceCount: number
  totalAmount: number
}

export interface PriceChangeEntry {
  product: string
  supplier: string
  oldPrice: number
  newPrice: number
  diff: number
  percent: number
  date: string
  invoiceNumber: string
}

export interface PriceChangesResponse {
  changes: PriceChangeEntry[]
  summary: {
    increasedCount: number
    decreasedCount: number
    avgIncreasePercent: number
    avgDecreasePercent: number
  }
}

export interface OutstandingDebtEntry {
  supplier: string
  amount: number
  oldestBucket: string
  priority: 'high' | 'medium' | 'low'
}

export type ActivityType = 'invoice_imported' | 'invoice_approved' | 'payment_recorded' | 'supplier_created' | 'price_changed'

export interface ActivityEntry {
  type: ActivityType
  ts: string
  label: string
  detail: number | null
}
