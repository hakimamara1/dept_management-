// js/submit.js — Submit Invoice view

let parsedInvoice = null;

function initSubmitView() {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const jsonArea  = document.getElementById('json-area');
  const parseBtn  = document.getElementById('btn-parse');
  const submitBtn = document.getElementById('btn-submit-invoice');
  const clearBtn  = document.getElementById('btn-clear');

  // ── Drag & Drop ──────────────────────────────────────────
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
  });

  // ── Parse Button ─────────────────────────────────────────
  parseBtn.addEventListener('click', () => {
    const raw = jsonArea.value.trim();
    if (!raw) { toast('الرجاء لصق محتوى JSON أولاً', 'warning'); return; }
    parseAndPreview(raw);
  });

  // ── Submit Button ─────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    if (!parsedInvoice) { toast('الرجاء تحليل JSON أولاً', 'warning'); return; }
    setLoading(submitBtn, true);
    const panel = document.getElementById('submit-result');
    panel.className = 'result-panel';
    panel.style.display = 'none';

    try {
      const result = await api.submitInvoice(parsedInvoice);
      showSubmitResult(result);
      toast('تم إرسال الفاتورة بنجاح', 'success');
    } catch (e) {
      panel.className = 'result-panel error show';
      panel.innerHTML = `
        <div class="result-title" style="color:var(--danger)">❌ فشل الإرسال</div>
        <p style="color:var(--text-secondary);font-size:.9rem">${e.message}</p>`;
      toast(e.message, 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // ── Clear Button ──────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    jsonArea.value = '';
    parsedInvoice = null;
    document.getElementById('invoice-preview').style.display = 'none';
    document.getElementById('submit-result').className = 'result-panel';
    submitBtn.disabled = true;
    toast('تم مسح البيانات', 'info');
  });
}

function readFile(file) {
  if (!file.name.endsWith('.json')) {
    toast('يُرجى رفع ملف JSON فقط', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('json-area').value = e.target.result;
    parseAndPreview(e.target.result);
    toast(`تم تحميل: ${file.name}`, 'success');
  };
  reader.readAsText(file, 'utf-8');
}

function parseAndPreview(raw) {
  try {
    parsedInvoice = JSON.parse(raw);
    renderInvoicePreview(parsedInvoice);
    document.getElementById('btn-submit-invoice').disabled = false;
    toast('تم تحليل JSON بنجاح ✅', 'success');
  } catch (e) {
    parsedInvoice = null;
    document.getElementById('invoice-preview').style.display = 'none';
    document.getElementById('btn-submit-invoice').disabled = true;
    toast('JSON غير صالح: ' + e.message, 'error');
  }
}

function renderInvoicePreview(inv) {
  const preview = document.getElementById('invoice-preview');
  preview.style.display = 'block';

  document.getElementById('prev-supplier').textContent  = inv.supplier?.name || '—';
  document.getElementById('prev-inv-num').textContent   = inv.invoice_number || '—';
  document.getElementById('prev-inv-date').textContent  = inv.invoice_date || '—';
  document.getElementById('prev-currency').textContent  = inv.currency || 'دج';
  document.getElementById('prev-prev-bal').textContent  = formatCurrency(inv.previous_balance);
  document.getElementById('prev-amount').textContent    = formatCurrency(inv.invoice_amount);
  document.getElementById('prev-discount').textContent  = formatCurrency(inv.discount);
  document.getElementById('prev-new-bal').textContent   = formatCurrency(inv.new_balance);
  document.getElementById('prev-notes').textContent     = inv.notes || '—';

  // Items table
  const tbody = document.getElementById('prev-items-tbody');
  const items = inv.items || [];
  tbody.innerHTML = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="primary">${item.product_name || '—'}</td>
      <td>${item.package || '—'}</td>
      <td>${item.quantity ?? '—'}</td>
      <td><span class="currency">${formatCurrency(item.unit_price)}</span></td>
      <td><span class="currency" style="color:var(--accent-light);font-weight:700">${formatCurrency(item.total_price)}</span></td>
    </tr>
  `).join('');

  document.getElementById('prev-items-count').textContent = items.length;
  document.getElementById('prev-total-sum').textContent =
    formatCurrency(items.reduce((s, it) => s + (parseFloat(it.total_price) || 0), 0));
}

function showSubmitResult(result) {
  const panel = document.getElementById('submit-result');
  const isApproved = result.status === 'Approved';
  panel.className = `result-panel ${isApproved ? 'success' : 'warning'} show`;

  const pendingList = (result.pendingItems || []).map(pi => `
    <li style="margin-bottom:4px">
      ⚠️ <strong>${pi.ocrName}</strong> —
      ${pi.matchResult?.message || 'يحتاج مراجعة'}
      <span class="badge badge-warning" style="margin-right:6px">
        ثقة: ${Math.round((pi.matchResult?.confidence || 0) * 100)}%
      </span>
    </li>
  `).join('');

  const errList = (result.validationErrors || []).map(e =>
    `<li style="margin-bottom:4px">❌ ${e.field}: ${e.message}</li>`
  ).join('');

  panel.innerHTML = `
    <div class="result-title" style="color:${isApproved ? 'var(--success)' : 'var(--warning)'}">
      ${isApproved ? '✅ تمت الموافقة على الفاتورة' : '🕐 الفاتورة قيد المراجعة'}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${pendingList || errList ? '16px' : '0'}">
      <div>
        <div class="text-muted text-sm">رقم الفاتورة</div>
        <div class="fw-700">#${result.invoiceId || '—'}</div>
      </div>
      <div>
        <div class="text-muted text-sm">المورد</div>
        <div class="fw-700">${result.supplier?.supplier?.name || '—'}</div>
      </div>
    </div>
    ${pendingList ? `
      <div style="margin-bottom:12px">
        <div class="fw-700 mb-8" style="color:var(--warning)">⚠️ منتجات تحتاج مطابقة (${result.pendingItems.length})</div>
        <ul style="list-style:none;font-size:.88rem;color:var(--text-secondary)">${pendingList}</ul>
      </div>` : ''}
    ${errList ? `
      <div>
        <div class="fw-700 mb-8" style="color:var(--danger)">أخطاء التحقق</div>
        <ul style="list-style:none;font-size:.88rem;color:var(--text-secondary)">${errList}</ul>
      </div>` : ''}
    ${!isApproved ? `
      <div style="margin-top:16px">
        <button class="btn btn-primary btn-sm" onclick="switchView('pending')">
          🔍 مراجعة الفواتير المعلقة
        </button>
      </div>` : ''}
  `;
}
