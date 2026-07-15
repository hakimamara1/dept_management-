// js/api.js — All API calls in one place
const BASE = 'http://localhost:3000';

const api = {
  // ── Health ──────────────────────────────────────────────
  async health() {
    const r = await fetch(`${BASE}/health`);
    return r.json();
  },

  // ── Invoices ─────────────────────────────────────────────
  async submitInvoice(json) {
    const r = await fetch(`${BASE}/api/invoices/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل إرسال الفاتورة');
    }
    return r.json();
  },

  async getPendingInvoices() {
    const r = await fetch(`${BASE}/api/invoices/pending`);
    if (!r.ok) throw new Error('فشل تحميل الفواتير المعلقة');
    return r.json();
  },

  async getInvoiceReview(id) {
    const r = await fetch(`${BASE}/api/invoices/${id}/review`);
    if (!r.ok) throw new Error('فشل تحميل بيانات الفاتورة');
    return r.json();
  },

  async approveInvoice(id, decisions) {
    const r = await fetch(`${BASE}/api/invoices/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل اعتماد الفاتورة');
    }
    return r.json();
  },

  // ── Products ──────────────────────────────────────────────
  async searchProducts(query) {
    if (!query?.trim()) return [];
    const r = await fetch(`${BASE}/api/products/search?query=${encodeURIComponent(query)}`);
    if (!r.ok) return [];
    return r.json();
  },

  async createProduct(data) {
    const r = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل إنشاء المنتج');
    }
    return r.json();
  },

  async getProductPriceHistory(id) {
    const r = await fetch(`${BASE}/api/products/${id}/price-history`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل تحميل سجل الأسعار');
    }
    return r.json();
  },

  // ── Analytics & Stats ──────────────────────────────────────
  async getStats() {
    const r = await fetch(`${BASE}/api/analytics/dashboard`);
    if (!r.ok) throw new Error('فشل تحميل الإحصائيات');
    return r.json();
  },

  // ── Stock & Inventory ─────────────────────────────────────
  async getStockSummary() {
    const r = await fetch(`${BASE}/api/stock/summary`);
    if (!r.ok) throw new Error('فشل تحميل ملخص المخزون');
    return r.json();
  },

  async getStockMovements(startDate, endDate) {
    const r = await fetch(`${BASE}/api/stock/movements?startDate=${startDate}&endDate=${endDate}`);
    if (!r.ok) throw new Error('فشل تحميل حركات المخزون');
    return r.json();
  },

  async getProductStockHistory(productId) {
    const r = await fetch(`${BASE}/api/stock/movements/${productId}`);
    if (!r.ok) throw new Error('فشل تحميل سجل حركة المنتج');
    return r.json();
  },

  async adjustStock(productId, actualQuantity, reason) {
    const r = await fetch(`${BASE}/api/stock/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, actualQuantity, reason }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل تسوية المخزون');
    }
    return r.json();
  },

  async getLowStock(threshold = 10) {
    const r = await fetch(`${BASE}/api/stock/low?threshold=${threshold}`);
    if (!r.ok) throw new Error('فشل تحميل تنبيهات انخفاض المخزون');
    return r.json();
  },

  // ── Suppliers & Debt ──────────────────────────────────────
  async getSuppliers(query = '') {
    const r = await fetch(`${BASE}/api/suppliers${query ? '?query=' + encodeURIComponent(query) : ''}`);
    if (!r.ok) throw new Error('فشل تحميل الموردين');
    return r.json();
  },

  async getSupplierAging() {
    const r = await fetch(`${BASE}/api/suppliers/aging`);
    if (!r.ok) throw new Error('فشل تحميل تقرير أعمار الديون');
    return r.json();
  },

  async getSupplierLedger(id) {
    const r = await fetch(`${BASE}/api/suppliers/${id}/ledger`);
    if (!r.ok) throw new Error('فشل تحميل كشف المورد');
    return r.json();
  },

  async getSupplierStatement(id, startDate, endDate) {
    let url = `${BASE}/api/suppliers/${id}/statement`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length) url += '?' + params.join('&');

    const r = await fetch(url);
    if (!r.ok) throw new Error('فشل تحميل كشف الحساب المفلتر');
    return r.json();
  },

  async recordSupplierPayment(id, { amount, paymentMethod, reference, notes, date }) {
    const r = await fetch(`${BASE}/api/suppliers/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paymentMethod, reference, notes, date }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || 'فشل تسجيل عملية الدفع');
    }
    return r.json();
  },

  // ── Accounting & Double-Entry ──────────────────────────────
  async getTrialBalance() {
    const r = await fetch(`${BASE}/api/accounting/trial-balance`);
    if (!r.ok) throw new Error('فشل تحميل ميزان المراجعة');
    return r.json();
  },

  async getBalanceSheet() {
    const r = await fetch(`${BASE}/api/accounting/balance-sheet`);
    if (!r.ok) throw new Error('فشل تحميل الميزانية العمومية');
    return r.json();
  },

  async getProfitLoss(startDate, endDate) {
    let url = `${BASE}/api/accounting/profit-loss`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length) url += '?' + params.join('&');

    const r = await fetch(url);
    if (!r.ok) throw new Error('فشل تحميل حساب الأرباح والخسائر');
    return r.json();
  },

  async getAccountLedger(accountCode) {
    const r = await fetch(`${BASE}/api/accounting/ledger/${accountCode}`);
    if (!r.ok) throw new Error(`فشل تحميل دفتر الأستاذ للحساب ${accountCode}`);
    return r.json();
  },

  async verifyAccountingBalance() {
    const r = await fetch(`${BASE}/api/accounting/verify`);
    if (!r.ok) throw new Error('فشل التحقق من مطابقة الدفاتر');
    return r.json();
  },

  async getJournalEntry(invoiceId) {
    const r = await fetch(`${BASE}/api/accounting/journal/${invoiceId}`);
    if (!r.ok) throw new Error('فشل تحميل قيود اليومية للفاتورة');
    return r.json();
  }
};

// ── Helpers ────────────────────────────────────────────────
function formatCurrency(val) {
  if (val == null || val === '') return '—';
  const n = typeof val === 'bigint' ? Number(val) : parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' دج';
}

function formatDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return str; }
}

function statusBadge(status) {
  const map = {
    'Approved': ['badge-success', '✅', 'معتمد'],
    'Pending Review': ['badge-warning', '🕐', 'قيد المراجعة'],
    'Rejected': ['badge-danger', '❌', 'مرفوض'],
    'Pending': ['badge-warning', '⏳', 'معلق'],
    'Matched': ['badge-success', '🔗', 'مطابق'],
    'NewProduct': ['badge-info', '🆕', 'منتج جديد'],
    'UserSelected': ['badge-success', '👤', 'مختار'],
  };
  const [cls, icon, label] = map[status] || ['badge-muted', '❓', status || '—'];
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  document.getElementById('toast-container').prepend(el);
  setTimeout(() => el.style.opacity = '0', 3500);
  setTimeout(() => el.remove(), 3800);
}

function setLoading(btn, loading) {
  if (loading) {
    btn._origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> جاري...`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._origText || btn.innerHTML;
    btn.disabled = false;
  }
}
