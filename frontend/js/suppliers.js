// js/suppliers.js — Suppliers & debt view controller

let currentSuppliersTab = 'list';

function initSuppliersView() {
  const dateEl = document.getElementById('pay-date');
  if (dateEl) {
    dateEl.value = new Date().toISOString().split('T')[0];
  }
}

async function loadSuppliersView() {
  switchSuppliersSubTab(currentSuppliersTab);
}

function switchSuppliersSubTab(tabName) {
  currentSuppliersTab = tabName;

  // Update button active state
  document.querySelectorAll('.subtab-btn-suppliers').forEach(btn => {
    btn.classList.replace('btn-primary', 'btn-ghost');
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`btn-suppliers-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.replace('btn-ghost', 'btn-primary');
    activeBtn.classList.add('active');
  }

  // Show/Hide tab content areas
  document.querySelectorAll('.suppliers-tab-content').forEach(el => {
    el.style.display = 'none';
  });

  const activeContent = document.getElementById(`suppliers-tab-${tabName}`);
  if (activeContent) activeContent.style.display = 'block';

  // Load data
  if (tabName === 'list') loadSuppliersList();
  if (tabName === 'aging') loadDebtAging();
}

// ── Load Suppliers List ───────────────────────────────────
async function loadSuppliersList() {
  const tbody = document.getElementById('suppliers-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr class="loading-row"><td colspan="5"><span class="spinner"></span> جاري تحميل الموردين...</td></tr>`;

  try {
    const suppliers = await api.getSuppliers();

    // Calculate total debt across all suppliers
    const totalDebt = suppliers.reduce((sum, s) => sum + Number(s.current_balance || 0), 0);
    const totalDebtEl = document.getElementById('suppliers-total-debt-display');
    if (totalDebtEl) totalDebtEl.textContent = formatCurrency(totalDebt);

    if (!suppliers.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">لا يوجد موردون مسجلون في النظام</td></tr>`;
      return;
    }

    tbody.innerHTML = suppliers.map(s => {
      const balance = Number(s.current_balance || 0);

      return `
        <tr>
          <td class="fw-700">${s.name}</td>
          <td>${s.phone || '—'}</td>
          <td>${s.commercial_register || '—'}</td>
          <td>
            <span style="font-weight:700; color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}">
              ${formatCurrency(balance)}
            </span>
          </td>
          <td>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:0.78rem;" 
                onclick="showPaymentModal(${s.id}, '${escapeAttr(s.name)}')">
                💸 دفع
              </button>
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:0.78rem;" 
                onclick="showStatementModal(${s.id}, '${escapeAttr(s.name)}')">
                📖 كشف حساب
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

// ── Load Debt Aging Report ────────────────────────────────
async function loadDebtAging() {
  const tbody = document.getElementById('suppliers-aging-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><span class="spinner"></span> جاري استخراج تقرير الديون...</td></tr>`;

  try {
    const report = await api.getSupplierAging();

    if (!report.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد ديون مستحقة حالياً للتحليل</td></tr>`;
      return;
    }

    tbody.innerHTML = report.map(r => {
      const total = Number(r.current_balance || 0);
      const b0_30 = Number(r._0_30 || 0);
      const b30_60 = Number(r._30_60 || 0);
      const b60_90 = Number(r._60_90 || 0);
      const b90_plus = Number(r._90_plus || 0);

      // Color code based on age: more old = more highlighted
      return `
        <tr>
          <td class="fw-700">${r.name}</td>
          <td class="fw-700" style="color:var(--danger)">${formatCurrency(total)}</td>
          <td>${b0_30 > 0 ? formatCurrency(b0_30) : '—'}</td>
          <td style="${b30_60 > 0 ? 'color:var(--warning); font-weight:500' : ''}">${b30_60 > 0 ? formatCurrency(b30_60) : '—'}</td>
          <td style="${b60_90 > 0 ? 'color:var(--warning); font-weight:600' : ''}">${b60_90 > 0 ? formatCurrency(b60_90) : '—'}</td>
          <td style="${b90_plus > 0 ? 'color:var(--danger); font-weight:700' : ''}">
            ${b90_plus > 0 ? `⚠️ ${formatCurrency(b90_plus)}` : '—'}
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

// ── Payment Modal ─────────────────────────────────────────
function showPaymentModal(id, name) {
  const overlay = document.getElementById('payment-modal');
  if (!overlay) return;

  document.getElementById('pay-supplier-id').value = id;
  document.getElementById('pay-supplier-name').value = name;
  document.getElementById('pay-amount').value = '';
  document.getElementById('pay-reference').value = '';
  document.getElementById('pay-notes').value = '';
  document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
  document.getElementById('payment-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function submitPaymentForm(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('pay-supplier-id').value);
  const amount = parseFloat(document.getElementById('pay-amount').value);
  const paymentMethod = document.getElementById('pay-method').value;
  const reference = document.getElementById('pay-reference').value.trim();
  const notes = document.getElementById('pay-notes').value.trim();
  const date = document.getElementById('pay-date').value;

  if (isNaN(amount) || amount <= 0) {
    toast('يرجى إدخال مبلغ دفع صالح وموجب', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-payment');
  setLoading(btn, true);

  try {
    await api.recordSupplierPayment(id, { amount, paymentMethod, reference, notes, date });
    toast('✅ تم تسجيل الدفعة وتعديل رصيد الحساب المزدوج بنجاح', 'success');
    closePaymentModal();
    
    // Refresh list
    loadSuppliersList();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ── Statement Ledger Modal ────────────────────────────────
function showStatementModal(id, name) {
  const overlay = document.getElementById('statement-modal');
  if (!overlay) return;

  document.getElementById('statement-supplier-id').value = id;
  document.getElementById('statement-modal-title').textContent = `كشف حساب المورد: ${name}`;
  
  // Clear filters
  document.getElementById('statement-start-date').value = '';
  document.getElementById('statement-end-date').value = '';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  loadStatementData(id);
}

function closeStatementModal() {
  document.getElementById('statement-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function loadStatementData(supplierId, start = null, end = null) {
  const tbody = document.getElementById('statement-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;"><span class="spinner"></span> جاري إعداد كشف الحساب...</td></tr>`;

  try {
    const entries = await api.getSupplierStatement(supplierId, start, end);

    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">لا توجد عمليات مسجلة لهذا المورد</td></tr>`;
      return;
    }

    tbody.innerHTML = entries.map(e => {
      const amt = Number(e.amount || 0);
      const balAfter = Number(e.balance_after || 0);

      let typeBadge = '';
      if (e.transaction_type === 'invoice') {
        typeBadge = '<span class="badge badge-danger badge-xs">🧾 فاتورة مشتريات</span>';
      } else if (e.transaction_type === 'payment') {
        typeBadge = '<span class="badge badge-success badge-xs">💸 دفعة مالية</span>';
      } else {
        typeBadge = `<span class="badge badge-warning badge-xs">🔧 ${e.transaction_type}</span>`;
      }

      // Display positive amounts (debt increases) as red, negative (payments) as green
      const amtColor = amt > 0 ? 'var(--danger)' : 'var(--success)';
      const formattedAmt = amt > 0 ? `+${formatCurrency(amt)}` : formatCurrency(amt);

      return `
        <tr>
          <td style="font-size:0.82rem;color:var(--text-secondary);">${new Date(e.created_at).toLocaleDateString('ar-DZ')}</td>
          <td>${typeBadge}</td>
          <td style="font-size:0.85rem;">
            ${e.description || ''} 
            ${e.invoice_number ? `<span style="color:var(--accent-light)"> (فاتورة #${e.invoice_number})</span>` : ''}
          </td>
          <td style="direction:ltr; font-weight:600; color:${amtColor}">${formattedAmt}</td>
          <td style="direction:ltr; font-weight:700;">${formatCurrency(balAfter)}</td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

function filterStatement() {
  const id = parseInt(document.getElementById('statement-supplier-id').value);
  const start = document.getElementById('statement-start-date').value;
  const end = document.getElementById('statement-end-date').value;
  loadStatementData(id, start || null, end || null);
}

function clearStatementFilter() {
  const id = parseInt(document.getElementById('statement-supplier-id').value);
  document.getElementById('statement-start-date').value = '';
  document.getElementById('statement-end-date').value = '';
  loadStatementData(id);
}
