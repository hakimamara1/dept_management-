// js/dashboard.js — Dashboard view
let lastStats = null;

async function loadDashboard() {
  const el = document.getElementById('view-dashboard');

  // Set loading state on stat cards
  el.querySelectorAll('.stat-value').forEach(v => {
    v.textContent = '—';
    v.style.opacity = '0.4';
  });

  try {
    // Check server health
    const health = await api.health().catch(() => null);
    const online = !!health?.status;
    updateServerStatus(online);

    // Load statistics and pending invoices in parallel
    const [stats, pending] = await Promise.all([
      api.getStats().catch(() => ({})),
      api.getPendingInvoices().catch(() => [])
    ]);

    // 1. Pending invoices count
    animateCount('stat-pending', stats.pending_invoices || pending.length);

    // 2. Pending items requiring match count
    const totalPendingItems = pending.reduce((s, inv) => s + (Number(inv.pending_items) || 0), 0);
    animateCount('stat-pending-items', totalPendingItems);

    // 3. Outstanding Supplier Debt (Currency)
    animateCount('stat-total-debt', Number(stats.total_debt || 0), true);

    // 4. Inventory Stock Value (Currency)
    animateCount('stat-stock-value', Number(stats.total_stock_value || 0), true);

    // Render recent pending invoices list (max 5)
    renderRecentPending(pending.slice(0, 5));

  } catch (e) {
    toast('فشل تحميل بيانات لوحة التحكم: ' + e.message, 'error');
  }
}

function animateCount(id, target, isCurrency = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = '1';
  const duration = 600;
  const start = performance.now();
  const from = 0;
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const currentVal = from + (target - from) * ease;
    
    if (isCurrency) {
      el.textContent = formatCurrency(Math.round(currentVal));
    } else {
      el.textContent = Math.round(currentVal);
    }
    
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = isCurrency ? formatCurrency(target) : target;
  };
  requestAnimationFrame(tick);
}

function renderRecentPending(invoices) {
  const tbody = document.getElementById('recent-pending-tbody');
  if (!tbody) return;

  if (!invoices.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding:40px;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">✅</div>
          لا توجد فواتير معلقة حالياً
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr onclick="switchView('pending')" style="cursor:pointer">
      <td class="primary">#${inv.invoice_number || '—'}</td>
      <td>${inv.supplier_name || '—'}</td>
      <td>${formatDate(inv.invoice_date)}</td>
      <td><span class="currency">${formatCurrency(inv.invoice_amount)}</span></td>
      <td>
        ${statusBadge(inv.status)}
        ${Number(inv.pending_items) > 0
          ? `<span class="badge badge-warning mt-4" style="margin-right:6px">⚠️ ${inv.pending_items} منتج</span>`
          : ''}
      </td>
    </tr>
  `).join('');
}
