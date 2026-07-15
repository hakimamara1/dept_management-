// js/stock.js — Stock & movements view controller

let currentStockTab = 'summary';

function initStockView() {
  // Set default dates for stock movements search (past 30 days)
  const today = new Date().toISOString().split('T')[0];
  const past30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const startEl = document.getElementById('stock-start-date');
  const endEl = document.getElementById('stock-end-date');
  
  if (startEl) startEl.value = past30Days;
  if (endEl) endEl.value = today;
}

async function loadStockView() {
  switchStockSubTab(currentStockTab);
}

function switchStockSubTab(tabName) {
  currentStockTab = tabName;
  
  // Update button active state
  document.querySelectorAll('.subtab-btn-stock').forEach(btn => {
    btn.classList.replace('btn-primary', 'btn-ghost');
    btn.classList.remove('active');
  });
  
  const activeBtn = document.getElementById(`btn-stock-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.replace('btn-ghost', 'btn-primary');
    activeBtn.classList.add('active');
  }

  // Show/Hide tab content areas
  document.querySelectorAll('.stock-tab-content').forEach(el => {
    el.style.display = 'none';
  });

  const activeContent = document.getElementById(`stock-tab-${tabName}`);
  if (activeContent) activeContent.style.display = 'block';

  // Load appropriate data
  if (tabName === 'summary') loadStockSummary();
  if (tabName === 'movements') loadStockMovements();
  if (tabName === 'low') loadLowStock();
}

// ── Load Stock Summary ────────────────────────────────────
async function loadStockSummary() {
  const tbody = document.getElementById('stock-summary-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><span class="spinner"></span> جاري تحميل قائمة المخزون...</td></tr>`;

  try {
    const data = await api.getStockSummary();
    
    // Update stock total value on screen header
    const totalValEl = document.getElementById('stock-total-value-display');
    if (totalValEl) totalValEl.textContent = formatCurrency(data.totalValue || 0);

    if (!data.summary || !data.summary.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد منتجات مسجلة في المخزن</td></tr>`;
      return;
    }

    tbody.innerHTML = data.summary.map(item => {
      const stock = Number(item.current_stock || 0);
      const avgCost = Number(item.average_cost || 0);
      const stockVal = Number(item.stock_value || 0);

      return `
        <tr>
          <td class="fw-700">${item.name}</td>
          <td>${item.category || '—'}</td>
          <td>${unitLabel(item.unit)}</td>
          <td>
            <span style="font-weight:700; color:${stock > 0 ? 'var(--success)' : 'var(--danger)'}">
              ${stock.toLocaleString('ar-DZ')}
            </span>
          </td>
          <td><span class="currency">${formatCurrency(avgCost)}</span></td>
          <td><span class="currency" style="color:var(--accent-light);font-weight:700;">${formatCurrency(stockVal)}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:0.78rem;" 
                onclick="showStockAdjustModal(${item.id}, '${escapeAttr(item.name)}', ${stock})">
                🔧 تسوية المخزون
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

// ── Load Stock Movements ──────────────────────────────────
async function loadStockMovements() {
  const tbody = document.getElementById('stock-movements-tbody');
  if (!tbody) return;

  const startDate = document.getElementById('stock-start-date')?.value;
  const endDate = document.getElementById('stock-end-date')?.value;

  if (!startDate || !endDate) {
    toast('يرجى اختيار تاريخ البدء وتاريخ الانتهاء التصفية', 'warning');
    return;
  }

  tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><span class="spinner"></span> جاري جلب حركات السلع...</td></tr>`;

  try {
    const movements = await api.getStockMovements(startDate, endDate);

    if (!movements.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد حركات مخزن مسجلة لهذه الفترة</td></tr>`;
      return;
    }

    tbody.innerHTML = movements.map(mov => {
      const qty = Number(mov.quantity || 0);
      const isPositive = qty > 0;
      
      let typeBadge = '';
      if (mov.movement_type === 'purchase') typeBadge = '<span class="badge badge-success">📥 شراء</span>';
      else if (mov.movement_type === 'sale') typeBadge = '<span class="badge badge-info">📤 بيع</span>';
      else if (mov.movement_type === 'adjustment') typeBadge = '<span class="badge badge-warning">🔧 تسوية</span>';
      else typeBadge = `<span class="badge badge-muted">${mov.movement_type}</span>`;

      return `
        <tr>
          <td style="font-size:0.85rem;color:var(--text-secondary);">${new Date(mov.created_at).toLocaleString('ar-DZ')}</td>
          <td class="fw-700">${mov.product_name || `منتج ID: ${mov.product_id}`}</td>
          <td>${typeBadge}</td>
          <td>
            <span style="font-weight:700; color:${isPositive ? 'var(--success)' : 'var(--danger)'}">
              ${isPositive ? '+' : ''}${qty.toLocaleString('ar-DZ')}
            </span>
          </td>
          <td><span class="currency">${mov.unit_cost ? formatCurrency(mov.unit_cost) : '—'}</span></td>
          <td style="font-size:0.85rem;color:var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${mov.reference || '—'}
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

function clearStockMovementsFilter() {
  const today = new Date().toISOString().split('T')[0];
  const past30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  document.getElementById('stock-start-date').value = past30Days;
  document.getElementById('stock-end-date').value = today;
  loadStockMovements();
}

// ── Load Low Stock Warnings ──────────────────────────────
async function loadLowStock() {
  const tbody = document.getElementById('stock-low-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr class="loading-row"><td colspan="5"><span class="spinner"></span> جاري التحقق من النواقص...</td></tr>`;

  try {
    const data = await api.getLowStock(10); // alert if stock is below 10

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:50px;">
            <div class="empty-state">
              <div class="empty-icon" style="opacity:1">🛡️</div>
              <div class="empty-title" style="color:var(--success)">المستودع آمن</div>
              <div class="empty-sub">لا توجد منتجات تقل كميتها عن الحد الأدنى (10 قطع)</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map(item => {
      const stock = Number(item.current_stock || 0);
      return `
        <tr>
          <td class="fw-700">${item.name}</td>
          <td>${item.category || '—'}</td>
          <td>${unitLabel(item.unit)}</td>
          <td>
            <span class="text-danger fw-700" style="font-size:1.05rem">
              ⚠️ ${stock.toLocaleString('ar-DZ')}
            </span>
          </td>
          <td>
            <span class="badge badge-danger">${stock === 0 ? 'نفذ المخزون' : 'مخزون منخفض جداً'}</span>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

// ── Adjust Stock Modal ────────────────────────────────────
function showStockAdjustModal(productId, productName, currentStock) {
  const overlay = document.getElementById('stock-adjust-modal');
  if (!overlay) return;

  document.getElementById('adjust-product-id').value = productId;
  document.getElementById('adjust-product-name').value = productName;
  document.getElementById('adjust-current-stock').value = currentStock.toLocaleString('ar-DZ');
  document.getElementById('adjust-actual-qty').value = '';
  document.getElementById('adjust-reason').value = '';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeStockAdjustModal() {
  document.getElementById('stock-adjust-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function submitStockAdjustForm(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('adjust-product-id').value);
  const actualQty = parseFloat(document.getElementById('adjust-actual-qty').value);
  const reason = document.getElementById('adjust-reason').value.trim();

  if (isNaN(actualQty) || actualQty < 0) {
    toast('يرجى إدخال كمية فعلية صالحة', 'warning');
    return;
  }
  if (!reason) {
    toast('سبب التسوية مطلوب لتسجيل العملية بالدفاتر', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-stock-adjust');
  setLoading(btn, true);

  try {
    const res = await api.adjustStock(id, actualQty, reason);
    const diff = Number(res.difference);
    const diffText = diff > 0 ? `زيادة بمقدار +${diff}` : `عجز بمقدار ${diff}`;
    
    toast(`✅ تم تسوية المخزون بنجاح (${diffText})`, 'success');
    closeStockAdjustModal();
    
    // Refresh the view
    loadStockSummary();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
