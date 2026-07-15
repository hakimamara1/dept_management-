// js/accounting.js — Double-entry accounting view controller

let currentAccountingTab = 'trial';

function initAccountingView() {
  // Select box change listener is attached inline in index.html
}

async function loadAccountingView() {
  switchAccountingSubTab(currentAccountingTab);
}

function switchAccountingSubTab(tabName) {
  currentAccountingTab = tabName;

  // Update button active state
  document.querySelectorAll('.subtab-btn-accounting').forEach(btn => {
    btn.classList.replace('btn-primary', 'btn-ghost');
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`btn-accounting-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.replace('btn-ghost', 'btn-primary');
    activeBtn.classList.add('active');
  }

  // Show/Hide tab content areas
  document.querySelectorAll('.accounting-tab-content').forEach(el => {
    el.style.display = 'none';
  });

  const activeContent = document.getElementById(`accounting-tab-${tabName}`);
  if (activeContent) activeContent.style.display = 'block';

  // Load data
  if (tabName === 'trial') loadTrialBalance();
  if (tabName === 'balance') loadBalanceSheet();
  if (tabName === 'pl') loadProfitLoss();
  if (tabName === 'ledger') loadAccountLedgerData();
}

// Translate account code to readable Arabic name
function getAccountLabel(code) {
  const map = {
    inventory: 'مخزون السلع (Inventory)',
    accounts_payable: 'حسابات الموردين الدائنة (Accounts Payable)',
    cash: 'الصندوق النقدي (Cash)',
    bank: 'حساب البنك (Bank)',
    sales: 'إيرادات المبيعات (Sales)',
    cogs: 'تكلفة المبيعات (COGS)',
    discount_received: 'الخصومات المكتسبة (Discounts)',
    tax_payable: 'الضرائب المستحقة (Input VAT)'
  };
  return map[code] || code;
}

// ── Load Trial Balance ────────────────────────────────────
async function loadTrialBalance() {
  const tbody = document.getElementById('accounting-trial-tbody');
  const badgeContainer = document.getElementById('accounting-status-badge');
  if (!tbody) return;

  tbody.innerHTML = `<tr class="loading-row"><td colspan="5"><span class="spinner"></span> جاري تحميل ميزان المراجعة...</td></tr>`;

  try {
    // 1. Verify Balance
    const verify = await api.verifyAccountingBalance();
    if (badgeContainer) {
      if (verify.balanced) {
        badgeContainer.innerHTML = `<span class="badge badge-success" style="font-size:0.9rem;padding:6px 12px;">✅ الدفاتر متطابقة (الفرق: 0.00 دج)</span>`;
      } else {
        badgeContainer.innerHTML = `<span class="badge badge-danger" style="font-size:0.9rem;padding:6px 12px;">⚠️ اختلال في ميزان المراجعة (الفرق: ${formatCurrency(verify.difference)})</span>`;
      }
    }

    // 2. Get Trial Balance
    const data = await api.getTrialBalance();

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد معاملات محاسبية مسجلة بعد</td></tr>`;
      return;
    }

    let sumDebits = 0;
    let sumCredits = 0;

    const rowsHtml = data.map(item => {
      const dr = Number(item.total_debit || 0);
      const cr = Number(item.total_credit || 0);
      const balance = Number(item.balance || 0);

      sumDebits += dr;
      sumCredits += cr;

      // Color code net balance based on nature: Debits normal accounts are typically positive
      const balanceText = balance > 0 
        ? `<span class="text-success">${formatCurrency(balance)} (مدين)</span>` 
        : balance < 0 
          ? `<span class="text-danger">${formatCurrency(Math.abs(balance))} (دائن)</span>`
          : '0.00 دج';

      return `
        <tr>
          <td style="font-family:monospace;color:var(--accent-light);">${item.account_code}</td>
          <td class="fw-700">${getAccountLabel(item.account_code)}</td>
          <td class="debit-column">${formatCurrency(dr)}</td>
          <td class="credit-column">${formatCurrency(cr)}</td>
          <td class="balance-column">${balanceText}</td>
        </tr>`;
    }).join('');

    // Summary row
    const summaryHtml = `
      <tr style="border-top:2px solid var(--accent); background:rgba(99,102,241,0.06); font-weight:800;">
        <td colspan="2">المجموع الإجمالي</td>
        <td class="text-success" style="font-size:1.05rem;">${formatCurrency(sumDebits)}</td>
        <td class="text-danger" style="font-size:1.05rem;">${formatCurrency(sumCredits)}</td>
        <td style="color:${Math.abs(sumDebits - sumCredits) < 0.01 ? 'var(--success)' : 'var(--danger)'}">
          ${Math.abs(sumDebits - sumCredits) < 0.01 ? '✅ متطابق' : `⚠️ الفرق: ${formatCurrency(Math.abs(sumDebits - sumCredits))}`}
        </td>
      </tr>`;

    tbody.innerHTML = rowsHtml + summaryHtml;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}

// ── Load Balance Sheet ────────────────────────────────────
async function loadBalanceSheet() {
  const assetsTbody = document.getElementById('balance-sheet-assets-tbody');
  const liabilitiesTbody = document.getElementById('balance-sheet-liabilities-tbody');
  const netWorthEl = document.getElementById('accounting-networth-display');

  if (!assetsTbody || !liabilitiesTbody) return;

  assetsTbody.innerHTML = `<tr><td style="text-align:center;padding:20px;"><span class="spinner"></span></td></tr>`;
  liabilitiesTbody.innerHTML = `<tr><td style="text-align:center;padding:20px;"><span class="spinner"></span></td></tr>`;

  try {
    const data = await api.getBalanceSheet();

    // 1. Render Assets (debit normal accounts: inventory, cash, bank)
    const assetAccounts = ['inventory', 'cash', 'bank'];
    const assetsDetail = await Promise.all(
      assetAccounts.map(async code => {
        const balance = await api.getAccountLedger(code).then(list => {
          // Dr - Cr for assets
          return list.reduce((sum, e) => sum + Number(e.debit || 0) - Number(e.credit || 0), 0);
        }).catch(() => 0);
        return { code, balance };
      })
    );

    const totalAssets = assetsDetail.reduce((sum, a) => sum + a.balance, 0);

    assetsTbody.innerHTML = assetsDetail.map(a => `
      <tr>
        <td class="fw-700">${getAccountLabel(a.code)}</td>
        <td class="debit-column text-left">${formatCurrency(a.balance)}</td>
      </tr>
    `).join('') + `
      <tr style="border-top:1px solid var(--border); font-weight:800; background:rgba(16,185,129,0.06);">
        <td>إجمالي الأصول (Total Assets)</td>
        <td class="text-success text-left">${formatCurrency(totalAssets)}</td>
      </tr>`;

    // 2. Render Liabilities (credit normal accounts: accounts_payable, tax_payable)
    const liabilityAccounts = ['accounts_payable', 'tax_payable'];
    const liabilitiesDetail = await Promise.all(
      liabilityAccounts.map(async code => {
        const balance = await api.getAccountLedger(code).then(list => {
          // Cr - Dr for liabilities
          return list.reduce((sum, e) => sum + Number(e.credit || 0) - Number(e.debit || 0), 0);
        }).catch(() => 0);
        return { code, balance };
      })
    );

    const totalLiabilities = liabilitiesDetail.reduce((sum, l) => sum + l.balance, 0);

    liabilitiesTbody.innerHTML = liabilitiesDetail.map(l => `
      <tr>
        <td class="fw-700">${getAccountLabel(l.code)}</td>
        <td class="credit-column text-left">${formatCurrency(l.balance)}</td>
      </tr>
    `).join('') + `
      <tr style="border-top:1px solid var(--border); font-weight:800; background:rgba(244,63,94,0.06);">
        <td>إجمالي الخصوم (Total Liabilities)</td>
        <td class="text-danger text-left">${formatCurrency(totalLiabilities)}</td>
      </tr>`;

    // 3. Render Net Worth (Assets - Liabilities)
    if (netWorthEl) {
      const netWorth = totalAssets - totalLiabilities;
      netWorthEl.textContent = formatCurrency(netWorth);
      netWorthEl.style.color = netWorth >= 0 ? 'var(--success)' : 'var(--danger)';
    }

  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Load Profit & Loss ────────────────────────────────────
async function loadProfitLoss() {
  try {
    const pl = await api.getProfitLoss();
    
    const salesVal = Number(pl.revenue || 0);
    const cogsVal = Number(pl.cogs || 0);
    const grossProfitVal = Number(pl.grossProfit || 0);
    const purchasesVal = Number(pl.purchases || 0);

    document.getElementById('pl-sales').textContent = formatCurrency(Math.abs(salesVal));
    document.getElementById('pl-cogs').textContent = formatCurrency(Math.abs(cogsVal));
    document.getElementById('pl-purchases').textContent = formatCurrency(Math.abs(purchasesVal));

    const gpEl = document.getElementById('pl-gross-profit');
    gpEl.textContent = formatCurrency(grossProfitVal);
    gpEl.className = grossProfitVal >= 0 ? 'fw-800 text-success' : 'fw-800 text-danger';

  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Load Account Ledger Data ──────────────────────────────
async function loadAccountLedgerData() {
  const tbody = document.getElementById('accounting-ledger-tbody');
  const select = document.getElementById('accounting-ledger-select');
  if (!tbody || !select) return;

  const accountCode = select.value;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;"><span class="spinner"></span> جاري تحميل قيد الأستاذ...</td></tr>`;

  try {
    const entries = await api.getAccountLedger(accountCode);

    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">لا توجد معاملات مسجلة لهذا الحساب حالياً</td></tr>`;
      return;
    }

    // 1. Calculate running balance mathematically from oldest to newest
    const sorted = [...entries].reverse(); // reverse copy to oldest first
    let balance = 0;
    
    const debitNormalAccounts = ['inventory', 'cash', 'bank', 'cogs', 'purchases'];
    const isDebitNormal = debitNormalAccounts.includes(accountCode);

    const calculated = sorted.map(e => {
      const dr = Number(e.debit || 0);
      const cr = Number(e.credit || 0);
      
      if (isDebitNormal) {
        balance += (dr - cr);
      } else {
        balance += (cr - dr);
      }
      
      return { ...e, runningBalance: balance };
    });

    // 2. Reverse back to display newest first
    calculated.reverse();

    tbody.innerHTML = calculated.map(e => {
      const dr = Number(e.debit || 0);
      const cr = Number(e.credit || 0);
      const bal = Number(e.runningBalance || 0);

      return `
        <tr>
          <td style="font-size:0.82rem;color:var(--text-secondary);">${new Date(e.transaction_date).toLocaleDateString('ar-DZ')}</td>
          <td style="font-size:0.88rem;">
            ${e.description || '—'}
            ${e.invoice_id ? `<span style="color:var(--accent-light);cursor:pointer;" onclick="switchView('pending')"> (فاتورة ID: #${e.invoice_id})</span>` : ''}
          </td>
          <td class="debit-column">${dr > 0 ? formatCurrency(dr) : '—'}</td>
          <td class="credit-column">${cr > 0 ? formatCurrency(cr) : '—'}</td>
          <td class="balance-column" style="direction:ltr;">${formatCurrency(bal)}</td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--danger)">❌ ${err.message}</td></tr>`;
    toast(err.message, 'error');
  }
}
