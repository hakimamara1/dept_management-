// js/pending.js — Pending Review view + Approval modal

let currentInvoiceId = null;
let reviewItems = [];
let decisions = {};   // itemId -> { action, productId, unit }

// ── Load pending list ─────────────────────────────────────
async function loadPendingInvoices() {
  const tbody = document.getElementById('pending-tbody');
  tbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="6"><span class="spinner"></span> جاري التحميل...</td>
    </tr>`;

  try {
    const invoices = await api.getPendingInvoices();
    renderPendingTable(invoices);

    // Update nav badge
    const badge = document.getElementById('nav-badge-pending');
    if (badge) badge.textContent = invoices.length;
  } catch (e) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">
        ❌ ${e.message}
      </td></tr>`;
    toast(e.message, 'error');
  }
}

function renderPendingTable(invoices) {
  const tbody = document.getElementById('pending-tbody');
  if (!invoices.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:60px;text-align:center">
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <div class="empty-title">لا توجد فواتير معلقة</div>
            <div class="empty-sub">جميع الفواتير تمت مراجعتها</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const pendingItems = Number(inv.pending_items) || 0;
    return `
      <tr onclick="openReviewModal(${inv.id})">
        <td class="primary">#${inv.invoice_number}</td>
        <td>${inv.supplier_name || '—'}</td>
        <td>${formatDate(inv.invoice_date)}</td>
        <td><span class="currency">${formatCurrency(inv.invoice_amount)}</span></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge badge-muted">📦 ${inv.total_items || 0}</span>
            ${pendingItems > 0
              ? `<span class="badge badge-warning">⚠️ ${pendingItems} معلق</span>`
              : `<span class="badge badge-success">✅ مكتمل</span>`}
          </div>
        </td>
        <td>${statusBadge(inv.status)}</td>
      </tr>`;
  }).join('');
}

// ── Open Review Modal ─────────────────────────────────────
async function openReviewModal(invoiceId) {
  currentInvoiceId = invoiceId;
  decisions = {};

  const overlay = document.getElementById('review-modal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-body-content').innerHTML = `
    <div style="text-align:center;padding:40px">
      <span class="spinner" style="width:32px;height:32px;border-width:4px"></span>
      <p style="margin-top:12px;color:var(--text-muted)">جاري تحميل بيانات الفاتورة...</p>
    </div>`;

  try {
    const data = await api.getInvoiceReview(invoiceId);
    reviewItems = data.items || [];
    renderModalContent(data.invoice, data.items);
  } catch (e) {
    document.getElementById('modal-body-content').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--danger)">❌ ${e.message}</div>`;
    toast(e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('review-modal').classList.remove('open');
  document.body.style.overflow = '';
  currentInvoiceId = null;
}

function renderModalContent(invoice, items) {
  const inv = invoice || {};
  document.getElementById('modal-inv-title').textContent =
    `مراجعة الفاتورة #${inv.invoice_number || currentInvoiceId}`;

  const pendingCount = items.filter(it => it.match_status === 'Pending' || !it.product_id).length;

  document.getElementById('modal-body-content').innerHTML = `
    <!-- Invoice Header -->
    <div class="invoice-header-grid">
      <div class="inv-field">
        <div class="inv-field-label">المورد</div>
        <div class="inv-field-value">${inv.supplier_name || '—'}</div>
      </div>
      <div class="inv-field">
        <div class="inv-field-label">رقم الفاتورة</div>
        <div class="inv-field-value">#${inv.invoice_number || '—'}</div>
      </div>
      <div class="inv-field">
        <div class="inv-field-label">التاريخ</div>
        <div class="inv-field-value">${formatDate(inv.invoice_date)}</div>
      </div>
      <div class="inv-field">
        <div class="inv-field-label">المبلغ</div>
        <div class="inv-field-value" style="color:var(--accent-light)">${formatCurrency(inv.invoice_amount)}</div>
      </div>
      <div class="inv-field">
        <div class="inv-field-label">الرصيد الجديد</div>
        <div class="inv-field-value" style="color:var(--warning)">${formatCurrency(inv.new_balance)}</div>
      </div>
      <div class="inv-field">
        <div class="inv-field-label">الحالة</div>
        <div class="inv-field-value">${statusBadge(inv.status)}</div>
      </div>
    </div>

    <!-- Items -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="fw-700">بنود الفاتورة</div>
      ${pendingCount > 0
        ? `<span class="badge badge-warning">⚠️ ${pendingCount} بنود تحتاج مطابقة</span>`
        : `<span class="badge badge-success">✅ جميع البنود مطابقة</span>`}
    </div>

    <div id="items-list">
      ${items.map(item => renderItemCard(item)).join('')}
    </div>
  `;

  // Attach search listeners
  items.forEach(item => {
    const input = document.getElementById(`search-${item.id}`);
    if (input) {
      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => doProductSearch(item.id, input.value), 280);
      });
      input.addEventListener('focus', () => {
        if (input.value.trim()) doProductSearch(item.id, input.value);
      });
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', closeAllDropdowns, { once: false });

  updateApproveButton();
}

function renderItemCard(item) {
  const isPending = item.match_status === 'Pending' || (!item.product_id && item.match_status !== 'Matched');
  const isResolved = decisions[item.id];

  return `
    <div class="match-item ${isResolved ? 'resolved' : ''}" id="item-card-${item.id}">
      <div class="match-item-header">
        <div>
          <div class="match-ocr-name">📦 ${item.ocr_product_name}</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px">
            الكمية: ${item.quantity} ·
            السعر: ${formatCurrency(item.unit_price)} ·
            المجموع: <span style="color:var(--accent-light);font-weight:700">${formatCurrency(item.total_price)}</span>
            ${item.package ? `· التعبئة: ${item.package}` : ''}
          </div>
          ${item.matched_product_name ? `
            <div style="font-size:.78rem;color:var(--success);margin-top:3px">
              🔗 مطابق مع: <strong>${item.matched_product_name}</strong>
            </div>` : ''}
          ${item.suggested_product_name ? `
            <div style="font-size:.78rem;color:var(--warning);margin-top:3px">
              💡 مقترح: <strong>${item.suggested_product_name}</strong>
            </div>` : ''}
        </div>
        <div class="match-actions">
          ${statusBadge(item.match_status)}
        </div>
      </div>

      ${isPending && !isResolved ? `
        <!-- Search existing product -->
        <div class="product-search-wrap">
          <input
            type="text"
            id="search-${item.id}"
            class="product-search-input"
            placeholder="🔍 ابحث عن منتج موجود..."
            autocomplete="off"
          />
          <div class="product-results-dropdown" id="dropdown-${item.id}"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          ${item.suggested_product_name ? `
            <button class="btn btn-ghost btn-sm"
              onclick="linkProduct(${item.id}, ${item.suggested_product_id}, '${escapeAttr(item.suggested_product_name)}')">
              ✅ تأكيد المقترح
            </button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="showCreateProduct(${item.id})">
            ➕ إنشاء منتج جديد
          </button>
        </div>
        <!-- Create new product inline -->
        <div id="create-form-${item.id}" style="display:none;margin-top:12px;padding:14px;background:rgba(99,102,241,.07);border-radius:var(--radius-md);border:1px solid var(--border)">
          <div class="fw-700 text-sm mb-8">إنشاء منتج جديد</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="form-label">اسم المنتج</label>
              <input type="text" id="new-name-${item.id}" class="form-control"
                value="${escapeAttr(item.ocr_product_name)}" placeholder="اسم المنتج" />
            </div>
            <div>
              <label class="form-label">الوحدة</label>
              <select id="new-unit-${item.id}" class="form-control">
                <option value="piece">قطعة</option>
                <option value="kg">كيلو</option>
                <option value="box">علبة</option>
                <option value="liter">لتر</option>
                <option value="g">غرام</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-sm mt-8"
            onclick="confirmCreateProduct(${item.id})">
            💾 حفظ وربط
          </button>
          <button class="btn btn-ghost btn-sm mt-8"
            onclick="document.getElementById('create-form-${item.id}').style.display='none'">
            إلغاء
          </button>
        </div>
      ` : isResolved ? `
        <div style="font-size:.85rem;color:var(--success);margin-top:6px">
          ✅ ${decisions[item.id].action === 'create_new'
            ? `سيتم إنشاء منتج جديد: <strong>${decisions[item.id]._name || ''}</strong>`
            : `ربط بـ: <strong>${decisions[item.id]._name || 'منتج محدد'}</strong>`}
          <button class="btn btn-ghost btn-sm" style="margin-right:10px;font-size:.75rem"
            onclick="undoDecision(${item.id})">تراجع</button>
        </div>
      ` : ''}
    </div>`;
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── Product search ────────────────────────────────────────
async function doProductSearch(itemId, query) {
  const dropdown = document.getElementById(`dropdown-${itemId}`);
  if (!query.trim()) { dropdown.classList.remove('open'); return; }

  dropdown.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:.85rem"><span class="spinner"></span> بحث...</div>`;
  dropdown.classList.add('open');

  const results = await api.searchProducts(query);
  if (!results.length) {
    dropdown.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:.85rem">لا نتائج</div>`;
    return;
  }

  dropdown.innerHTML = results.map(p => `
    <div class="product-option" onclick="linkProduct(${itemId}, ${p.id}, '${escapeAttr(p.name)}')">
      <span class="p-name">${p.name}</span>
      <span class="p-meta">${p.unit || ''} ${p.current_stock != null ? `· مخزون: ${p.current_stock}` : ''}</span>
    </div>`).join('');
}

function closeAllDropdowns(e) {
  if (!e.target.classList.contains('product-search-input')) {
    document.querySelectorAll('.product-results-dropdown').forEach(d => d.classList.remove('open'));
  }
}

// ── Decisions ─────────────────────────────────────────────
function linkProduct(itemId, productId, productName) {
  decisions[itemId] = { action: 'select_existing', productId, _name: productName };
  document.getElementById(`dropdown-${itemId}`)?.classList.remove('open');

  // Re-render that card
  const card = document.getElementById(`item-card-${itemId}`);
  const item = reviewItems.find(i => i.id === itemId);
  if (card && item) card.outerHTML = renderItemCard(item);

  // Re-attach listener for the replaced card if needed
  updateApproveButton();
  toast(`تم ربط: ${productName}`, 'success');
}

function showCreateProduct(itemId) {
  const form = document.getElementById(`create-form-${itemId}`);
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function confirmCreateProduct(itemId) {
  const name = document.getElementById(`new-name-${itemId}`)?.value?.trim();
  const unit = document.getElementById(`new-unit-${itemId}`)?.value || 'piece';
  if (!name) { toast('أدخل اسم المنتج', 'warning'); return; }

  decisions[itemId] = { action: 'create_new', productId: null, unit, _name: name };
  const card = document.getElementById(`item-card-${itemId}`);
  const item = reviewItems.find(i => i.id === itemId);
  if (card && item) card.outerHTML = renderItemCard(item);
  updateApproveButton();
  toast(`سيتم إنشاء: ${name}`, 'info');
}

function undoDecision(itemId) {
  delete decisions[itemId];
  const card = document.getElementById(`item-card-${itemId}`);
  const item = reviewItems.find(i => i.id === itemId);
  if (card && item) card.outerHTML = renderItemCard(item);

  // Re-attach listener
  const input = document.getElementById(`search-${itemId}`);
  if (input) {
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doProductSearch(itemId, input.value), 280);
    });
  }
  updateApproveButton();
}

// ── Approve ───────────────────────────────────────────────
function updateApproveButton() {
  const btn = document.getElementById('btn-approve');
  if (!btn) return;
  const pendingUnresolved = reviewItems.filter(it =>
    (it.match_status === 'Pending' || (!it.product_id && it.match_status !== 'Matched'))
    && !decisions[it.id]
  );
  btn.disabled = pendingUnresolved.length > 0 && Object.keys(decisions).length === 0;

  const d = Object.keys(decisions).length;
  btn.textContent = `✅ اعتماد الفاتورة${d > 0 ? ` (${d} قرار)` : ''}`;
}

async function approveInvoice() {
  if (!currentInvoiceId) return;
  const btn = document.getElementById('btn-approve');
  setLoading(btn, true);

  try {
    const decisionList = Object.entries(decisions).map(([itemId, d]) => ({
      itemId: parseInt(itemId),
      action: d.action,
      productId: d.productId,
      unit: d.unit,
    }));

    await api.approveInvoice(currentInvoiceId, decisionList);
    toast('✅ تمت الموافقة على الفاتورة بنجاح!', 'success');
    closeModal();
    loadPendingInvoices(); // refresh
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
