// js/products.js — Products view

let productSearchDebounce;

function initProductsView() {
  const searchInput = document.getElementById('product-search-input');
  searchInput?.addEventListener('input', () => {
    clearTimeout(productSearchDebounce);
    productSearchDebounce = setTimeout(() => {
      const q = searchInput.value.trim();
      if (q) {
        searchProducts(q);
      } else {
        document.getElementById('products-tbody').innerHTML = `
          <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">
            ابحث عن منتج بكتابة اسمه أعلاه
          </td></tr>`;
      }
    }, 300);
  });

  // Add product form
  document.getElementById('btn-save-product')?.addEventListener('click', saveProduct);
}

async function searchProducts(query) {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="7"><span class="spinner"></span> جاري البحث...</td>
    </tr>`;

  try {
    const results = await api.searchProducts(query);
    renderProductsTable(results, query);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderProductsTable(products, query = '') {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:50px;text-align:center">
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">لا نتائج لـ "${query}"</div>
            <div class="empty-sub">حاول بكلمات أخرى أو أضف المنتج يدوياً</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="primary">${highlight(p.name, query)}</td>
      <td>${p.barcode || '—'}</td>
      <td>${p.category || '—'}</td>
      <td>${unitLabel(p.unit)}</td>
      <td>
        <span style="font-weight:700;color:${
          (p.current_stock || 0) > 0 ? 'var(--success)' : 'var(--danger)'
        }">
          ${p.current_stock != null ? Number(p.current_stock).toLocaleString('ar') : '—'}
        </span>
      </td>
      <td>
        <div style="font-size:.85rem">
          ${p.last_purchase_price ? `<div style="color:var(--text-secondary)">آخر شراء: <span class="currency">${formatCurrency(p.last_purchase_price)}</span></div>` : ''}
          ${p.average_cost ? `<div style="color:var(--accent-light)">متوسط: <span class="currency">${formatCurrency(p.average_cost)}</span></div>` : '—'}
        </div>
      </td>
      <td>
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:0.78rem;"
          onclick="showPriceHistoryModal(${p.id}, '${escapeAttr(p.name)}')">
          📈 سجل الأسعار
        </button>
      </td>
    </tr>`).join('');
}

function highlight(text, query) {
  if (!query || !text) return text || '—';
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark style="background:rgba(99,102,241,.3);color:var(--accent-light);border-radius:3px;padding:0 2px">$1</mark>');
}

function unitLabel(unit) {
  const map = { piece: 'قطعة', kg: 'كيلو', box: 'علبة', liter: 'لتر', g: 'غرام' };
  return map[unit] || unit || '—';
}

function toggleAddProductForm() {
  const form = document.getElementById('add-product-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') {
    document.getElementById('prod-name')?.focus();
  }
}

async function saveProduct() {
  const name     = document.getElementById('prod-name')?.value?.trim();
  const barcode  = document.getElementById('prod-barcode')?.value?.trim();
  const category = document.getElementById('prod-category')?.value?.trim();
  const unit     = document.getElementById('prod-unit')?.value;

  if (!name) { toast('اسم المنتج مطلوب', 'warning'); return; }

  const btn = document.getElementById('btn-save-product');
  setLoading(btn, true);

  try {
    const result = await api.createProduct({ name, barcode, category, unit });
    toast(`✅ تم إضافة المنتج (ID: ${result.id})`, 'success');

    // Reset form
    ['prod-name','prod-barcode','prod-category'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('add-product-form').style.display = 'none';

    // Refresh search if there's a query
    const q = document.getElementById('product-search-input')?.value?.trim();
    if (q) searchProducts(q);
    else searchProducts(name);

  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ── Price History Modal ────────────────────────────────────
async function showPriceHistoryModal(productId, productName) {
  const overlay = document.getElementById('price-history-modal');
  if (!overlay) return;

  document.getElementById('price-history-title').textContent = `📈 سجل الأسعار — ${productName}`;
  document.getElementById('price-history-stats').innerHTML = '';
  document.getElementById('price-history-chart').innerHTML = `
    <div style="text-align:center;padding:50px"><span class="spinner"></span> جاري تحميل السجل...</div>`;
  document.getElementById('price-history-table-body').innerHTML = '';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const data = await api.getProductPriceHistory(productId);
    renderPriceHistoryStats(data.stats);
    renderPriceHistoryChart(document.getElementById('price-history-chart'), data.points);
    renderPriceHistoryTable(data.points);
  } catch (e) {
    document.getElementById('price-history-chart').innerHTML =
      `<div style="text-align:center;padding:40px;color:var(--danger)">❌ ${e.message}</div>`;
    toast(e.message, 'error');
  }
}

function closePriceHistoryModal() {
  document.getElementById('price-history-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderPriceHistoryStats(stats) {
  const box = document.getElementById('price-history-stats');
  if (!stats) { box.innerHTML = ''; return; }

  const trendBadge = stats.trend === 'up'
    ? `<span class="badge badge-danger">▲ ${Math.abs(stats.changePct).toFixed(1)}%</span>`
    : stats.trend === 'down'
      ? `<span class="badge badge-success">▼ ${Math.abs(stats.changePct).toFixed(1)}%</span>`
      : `<span class="badge badge-muted">— مستقر</span>`;

  box.innerHTML = `
    <div class="ph-stat">
      <div class="ph-stat-label">آخر سعر</div>
      <div class="ph-stat-value">${formatCurrency(stats.last)}</div>
      ${trendBadge}
    </div>
    <div class="ph-stat">
      <div class="ph-stat-label">أقل سعر</div>
      <div class="ph-stat-value" style="color:var(--success)">${formatCurrency(stats.min)}</div>
    </div>
    <div class="ph-stat">
      <div class="ph-stat-label">أعلى سعر</div>
      <div class="ph-stat-value" style="color:var(--danger)">${formatCurrency(stats.max)}</div>
    </div>
    <div class="ph-stat">
      <div class="ph-stat-label">متوسط السعر</div>
      <div class="ph-stat-value">${formatCurrency(stats.avg)}</div>
    </div>
    <div class="ph-stat">
      <div class="ph-stat-label">عدد الفواتير</div>
      <div class="ph-stat-value">${stats.count.toLocaleString('ar-DZ')}</div>
    </div>`;
}

function renderPriceHistoryTable(points) {
  const tbody = document.getElementById('price-history-table-body');
  if (!points.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد بيانات بعد</td></tr>`;
    return;
  }
  tbody.innerHTML = points.slice().reverse().map(p => `
    <tr>
      <td style="font-size:.85rem;color:var(--text-secondary)">${formatDate(p.date)}</td>
      <td class="fw-700"><span class="currency">${formatCurrency(p.price)}</span></td>
      <td>${Number(p.quantity).toLocaleString('ar-DZ')}</td>
      <td>${p.supplier || '—'}</td>
      <td style="font-size:.85rem;color:var(--text-secondary)">#${p.invoiceNumber}</td>
    </tr>`).join('');
}

// ── Price History Chart (inline SVG line chart, no dependencies) ──
const PH_CHART = { W: 640, H: 220, PAD_L: 50, PAD_R: 16, PAD_T: 18, PAD_B: 16 };

function renderPriceHistoryChart(container, points) {
  container.innerHTML = '';

  if (!points || !points.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:20px 0">
        <div class="empty-icon">📈</div>
        <div class="empty-title">لا يوجد سجل أسعار بعد</div>
        <div class="empty-sub">سيظهر هنا اتجاه السعر بعد أول فاتورة معتمدة لهذا المنتج</div>
      </div>`;
    return;
  }

  const { W, H, PAD_L, PAD_R, PAD_T, PAD_B } = PH_CHART;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xs = points.map(p => new Date(p.date).getTime());
  const ys = points.map(p => p.price);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
  const ySpan = (yMaxRaw - yMinRaw) || (yMaxRaw * 0.1) || 1;
  const yMin = yMinRaw - ySpan * 0.15;
  const yMax = yMaxRaw + ySpan * 0.15;

  const xPos = (t) => xs.length > 1 ? PAD_L + ((t - xMin) / (xMax - xMin || 1)) * plotW : PAD_L + plotW / 2;
  const yPos = (v) => PAD_T + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const coords = points.map(p => ({ ...p, x: xPos(new Date(p.date).getTime()), y: yPos(p.price) }));

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'ph-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `اتجاه سعر الشراء عبر ${points.length} ${points.length === 1 ? 'فاتورة' : 'فواتير'}`);

  // Gridlines: max / mid / min, one-step-off-surface, hairline
  [yMaxRaw, (yMaxRaw + yMinRaw) / 2, yMinRaw].forEach(v => {
    const y = yPos(v);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', PAD_L); line.setAttribute('x2', W - PAD_R);
    line.setAttribute('y1', y.toFixed(1)); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('class', 'ph-grid');
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', PAD_L - 8);
    label.setAttribute('y', (y + 3).toFixed(1));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'ph-axis-label');
    label.textContent = Math.round(v).toLocaleString('ar-DZ');
    svg.appendChild(label);
  });

  if (coords.length > 1) {
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const baseline = (PAD_T + plotH).toFixed(1);
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`;

    const area = document.createElementNS(svgNS, 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('class', 'ph-area');
    svg.appendChild(area);

    const line = document.createElementNS(svgNS, 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('class', 'ph-line');
    svg.appendChild(line);
  }

  // Dots (visible marker + larger invisible hit target)
  coords.forEach((c, i) => {
    const hit = document.createElementNS(svgNS, 'circle');
    hit.setAttribute('cx', c.x.toFixed(1)); hit.setAttribute('cy', c.y.toFixed(1));
    hit.setAttribute('r', 14);
    hit.setAttribute('class', 'ph-hit');
    svg.appendChild(hit);

    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', c.x.toFixed(1)); dot.setAttribute('cy', c.y.toFixed(1));
    dot.setAttribute('r', i === coords.length - 1 ? 5 : 4);
    dot.setAttribute('class', 'ph-dot');
    dot.dataset.index = i;
    svg.appendChild(dot);
  });

  // Direct end-label: latest price, colored by cost direction (up = costs more = bad)
  const first = points[0].price, last = points[points.length - 1].price;
  const trendColor = last > first ? 'var(--danger)' : last < first ? 'var(--success)' : 'var(--text-secondary)';
  const lastC = coords[coords.length - 1];
  const endLabel = document.createElementNS(svgNS, 'text');
  const anchorEnd = lastC.x + 70 > W - PAD_R;
  endLabel.setAttribute('x', (anchorEnd ? lastC.x - 8 : lastC.x + 8).toFixed(1));
  endLabel.setAttribute('y', Math.max(PAD_T + 10, lastC.y - 10).toFixed(1));
  endLabel.setAttribute('text-anchor', anchorEnd ? 'end' : 'start');
  endLabel.setAttribute('class', 'ph-end-label');
  endLabel.setAttribute('fill', trendColor);
  endLabel.textContent = formatCurrency(last);
  svg.appendChild(endLabel);

  // Crosshair (hidden until hover)
  const crosshair = document.createElementNS(svgNS, 'line');
  crosshair.setAttribute('y1', PAD_T); crosshair.setAttribute('y2', PAD_T + plotH);
  crosshair.setAttribute('class', 'ph-crosshair');
  svg.appendChild(crosshair);

  container.appendChild(svg);

  // Tooltip (HTML overlay, positioned via JS)
  const tooltip = document.createElement('div');
  tooltip.className = 'ph-tooltip';
  container.style.position = 'relative';
  container.appendChild(tooltip);

  function showTooltip(i, clientX, clientY) {
    const c = coords[i];
    crosshair.setAttribute('x1', c.x.toFixed(1));
    crosshair.setAttribute('x2', c.x.toFixed(1));
    crosshair.classList.add('active');

    svg.querySelectorAll('.ph-dot').forEach(d => d.classList.remove('active'));
    svg.querySelector(`.ph-dot[data-index="${i}"]`)?.classList.add('active');

    const dateEl = document.createElement('div');
    dateEl.className = 'ph-tooltip-date';
    dateEl.textContent = formatDate(c.date);

    const priceEl = document.createElement('div');
    priceEl.className = 'ph-tooltip-price';
    priceEl.textContent = formatCurrency(c.price);

    const metaEl = document.createElement('div');
    metaEl.className = 'ph-tooltip-meta';
    metaEl.textContent = `${c.supplier || '—'} · الكمية ${Number(c.quantity).toLocaleString('ar-DZ')} · فاتورة #${c.invoiceNumber}`;

    tooltip.replaceChildren(dateEl, priceEl, metaEl);
    tooltip.classList.add('active');

    const rect = container.getBoundingClientRect();
    let left = clientX - rect.left + 14;
    if (left + 190 > rect.width) left = clientX - rect.left - 204;
    tooltip.style.left = `${Math.max(4, left)}px`;
    tooltip.style.top = `${Math.max(4, clientY - rect.top - 64)}px`;
  }

  function hideTooltip() {
    crosshair.classList.remove('active');
    svg.querySelectorAll('.ph-dot').forEach(d => d.classList.remove('active'));
    tooltip.classList.remove('active');
  }

  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0, best = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - px);
      if (d < best) { best = d; nearest = i; }
    });
    showTooltip(nearest, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', hideTooltip);
}
