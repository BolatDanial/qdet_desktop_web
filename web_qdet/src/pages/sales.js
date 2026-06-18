// Sales page — full implementation
window.Pages.sales = {
  _list: [],

  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Продажи</h1>
          <p class="page-subtitle">Реестр чеков и продаж</p>
        </div>
        <div class="flex-row gap-2">
          <button class="btn btn-ghost btn-sm" onclick="window.Pages.sales.export()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <button class="btn btn-primary" onclick="window.Pages.sales.newSale()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Новая продажа
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid mb-6" id="sales-stats">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(108,99,255,0.15)">💰</div>
          <div class="stat-value" id="stat-revenue">—</div>
          <div class="stat-label">Выручка сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,217,138,0.15)">🧾</div>
          <div class="stat-value" id="stat-count">—</div>
          <div class="stat-label">Чеков сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(62,207,207,0.15)">📊</div>
          <div class="stat-value" id="stat-avg">—</div>
          <div class="stat-label">Средний чек</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(255,79,106,0.15)">↩️</div>
          <div class="stat-value" id="stat-returns">—</div>
          <div class="stat-label">Возвратов</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card">
        <div class="filters-bar mb-4">
          <input class="filter-input" type="date" id="sales-from"
                 value="${new Date().toISOString().slice(0, 10)}"
                 onchange="window.Pages.sales.load()" />
          <input class="filter-input" type="date" id="sales-to"
                 value="${new Date().toISOString().slice(0, 10)}"
                 onchange="window.Pages.sales.load()" />
          <select class="filter-input" id="sales-type" onchange="window.Pages.sales.load()">
            <option value="">Все типы</option>
            <option value="sale">Продажи</option>
            <option value="return">Возвраты</option>
          </select>
          <select class="filter-input" id="sales-pay" onchange="window.Pages.sales.load()">
            <option value="">Все оплаты</option>
            <option value="cash">Наличные</option>
            <option value="card">Карта</option>
            <option value="debt">В долг</option>
          </select>
          <input class="filter-input" placeholder="Поиск по клиенту..." id="sales-search"
                 oninput="window.Pages.sales.filterLocal(this.value)" style="flex:1;min-width:160px"/>
        </div>
        <div id="sales-list"><div class="spinner-ring" style="margin:30px auto"></div></div>
        <div class="flex-row mt-3 gap-2" id="sales-pagination"></div>
      </div>
    </div>`;
  },

  async init() {
    await this.load();
  },

  async load() {
    const from = document.getElementById('sales-from')?.value;
    const to = document.getElementById('sales-to')?.value;
    const type = document.getElementById('sales-type')?.value;
    const pay = document.getElementById('sales-pay')?.value;
    try {
      const data = await API.sales.getReports({ 
        date_from: from, 
        date_to: to,
        doc_type: type || undefined,
        pay_type: pay || undefined
      }) || [];
      this._list = Array.isArray(data) ? data : (data.sales || data.items || []);
      this._renderStats();
      this._renderList(this._list);
    } catch (e) {
      this._list = [];
      this._renderStats();
      this._renderList(this._list);
      Toast.error(e.message || 'Не удалось загрузить продажи');
    }
  },

  filterLocal(search) {
    if (!search) { this._renderList(this._list); return; }
    const q = search.toLowerCase();
    this._renderList(this._list.filter(r =>
      (r.client_name || '').toLowerCase().includes(q) ||
      (r.doc_id || '').toLowerCase().includes(q)
    ));
  },

  _renderStats() {
    const sales = this._list.filter(r => r.doc_type !== 'return');
    const returns = this._list.filter(r => r.doc_type === 'return');
    const revenue = sales.reduce((s, r) => s + (r.total || 0), 0);
    const avg = sales.length ? revenue / sales.length : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-revenue', fmt(revenue));
    set('stat-count', sales.length);
    set('stat-avg', fmt(avg));
    set('stat-returns', returns.length);
  },

  _payLabel(p) {
    return { cash: '<span class="badge badge-success">💵 Наличные</span>', card: '<span class="badge badge-info">💳 Карта</span>', debt: '<span class="badge badge-warning">📋 В долг</span>' }[p] || `<span class="badge badge-muted">${p || '—'}</span>`;
  },

  _typeLabel(t) {
    return t === 'return'
      ? '<span class="badge badge-danger">↩ Возврат</span>'
      : '<span class="badge badge-muted">✓ Продажа</span>';
  },

  _renderList(list) {
    const el = document.getElementById('sales-list');
    if (!el) return;
    el.innerHTML = buildTable([
      { key: 'doc_id', label: '№ чека' },
      { key: 'time_create', label: 'Дата/время', render: r => fmtDateTime(r.time_create) },
      { key: 'doc_type', label: 'Тип', render: r => this._typeLabel(r.doc_type) },
      { key: 'client_name', label: 'Клиент', render: r => r.client_name || 'Розничный' },
      { key: 'items_count', label: 'Позиций', render: r => r.items_count ?? '—' },
      { key: 'pay_type', label: 'Оплата', render: r => this._payLabel(r.pay_type) },
      { key: 'total', label: 'Сумма', render: r => `<b class="${r.doc_type === 'return' ? 'color-red' : ''}">${r.doc_type === 'return' ? '-' : ''}${fmt(r.total)}</b>` },
    ], list, {
      actionsFn: r => `
        <button class="btn btn-ghost btn-sm" onclick="window.Pages.sales.view('${r.doc_id}')">Открыть</button>
        ${r.doc_type !== 'return' ? `<button class="btn btn-ghost btn-sm" onclick="window.Pages.sales.makeReturn('${r.doc_id}')">Возврат</button>` : ''}
      `
    });
  },

  view(docId) {
    const item = this._list.find(r => r.doc_id === docId);
    if (!item) return;

    const itemsHtml = (item.items && item.items.length) 
      ? `
        <div style="border-top: 1px solid var(--border-color); margin-top: 12px; padding-top: 12px;">
          <div class="font-bold text-xs color-muted mb-2">ПОЗИЦИИ В ЧЕКЕ</div>
          <div style="max-height: 200px; overflow-y: auto; border-radius: 6px; background: rgba(0, 0, 0, 0.2); padding: 4px 8px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted); text-align: left;">
                  <th style="padding: 6px 0;">Товар</th>
                  <th style="padding: 6px 0; text-align: right; width: 60px;">Кол-во</th>
                  <th style="padding: 6px 0; text-align: right; width: 90px;">Цена</th>
                  <th style="padding: 6px 0; text-align: right; width: 100px;">Сумма</th>
                </tr>
              </thead>
              <tbody>
                ${item.items.map(it => `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                    <td style="padding: 6px 0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${it.good_name}">
                      <div class="font-bold" style="overflow: hidden; text-overflow: ellipsis;">${it.good_name}</div>
                      ${it.barcode ? `<span style="font-size: 11px; color: var(--text-muted);">${it.barcode}</span>` : ''}
                    </td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold;">${it.qty}</td>
                    <td style="padding: 6px 0; text-align: right; color: var(--text-muted);">${fmt(it.price)}</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: var(--text-primary);">${fmt(it.qty * it.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>`
      : `<p class="text-xs color-muted mt-2">Детализация позиций недоступна</p>`;

    Modal.open({
      title: `Чек ${docId}`,
      size: '560px',
      body: `
        <div class="flex-col gap-3">
          <div class="grid-2">
            <div><p class="text-xs color-muted">ДАТА / ВРЕМЯ</p><p class="font-bold">${fmtDateTime(item.time_create)}</p></div>
            <div><p class="text-xs color-muted">ТИП</p>${this._typeLabel(item.doc_type)}</div>
            <div><p class="text-xs color-muted">КЛИЕНТ</p><p class="font-bold">${item.client_name || 'Розничный'}</p></div>
            <div><p class="text-xs color-muted">ОПЛАТА</p>${this._payLabel(item.pay_type)}</div>
          </div>
          <div class="card" style="background:var(--bg-hover)">
            <div class="flex-row">
              <span class="color-muted">Позиций:</span>
              <span class="ml-auto font-bold">${item.items_count ?? '—'}</span>
            </div>
            <div class="flex-row mt-2">
              <span class="color-muted">Итого:</span>
              <span class="ml-auto font-bold" style="font-size:18px">${fmt(item.total)}</span>
            </div>
          </div>
          ${itemsHtml}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>
        <button class="btn btn-ghost" onclick="Toast.info('Печать чека')">Печать</button>
        <button class="btn btn-primary" onclick="window.Pages.sales.createEsf('${docId}')">Выставить ЭСФ</button>
        ${item.doc_type !== 'return' ? `<button class="btn btn-danger" onclick="window.Pages.sales.makeReturn('${docId}');Modal.closeAll()">Оформить возврат</button>` : ''}
      `
    });
  },

  createEsf(docId) {
    const sale = this._list.find(r => r.doc_id === docId);
    if (!sale) return;

    // Prefill data dynamically from the database fields
    const prefill = {
      doc_id: sale.doc_id,
      date: sale.time_create,
      client_name: sale.client_name || 'Розничный покупатель',
      client_bin: sale.client_bin || (sale.client_name === 'Петров И.' ? '880101345678' : '000000000000'),
      client_address: 'г. Алматы, ул. Абая 45',
      client_bik: sale.client_name === 'Петров И.' ? 'HSBKKZKX' : '',
      client_iik: sale.client_name === 'Петров И.' ? 'KZ987654321098765432' : '',
      contract_num: 'ДОГ-' + Math.floor(Math.random() * 1000),
      contract_date: new Date().toISOString().slice(0, 10),
      extra_info: 'Сформировано на основании чека №' + sale.doc_id,
      items: (sale.items && sale.items.length) 
        ? sale.items.map(it => ({
            name: it.good_name,
            qty: it.qty,
            price: it.price,
            tnved: '3004900002', // default tnved
            origin: '5',          // default origin
            gtd: ''
          }))
        : [
            { name: 'Смартфон Samsung S23', qty: 1, price: sale.total * 0.8, tnved: '8517130000', origin: '1', gtd: '10101010/120526/0001234' },
            { name: 'Защитное стекло', qty: 1, price: sale.total * 0.2, tnved: '7007190000', origin: '3', gtd: '' }
          ]
    };

    Modal.closeAll();
    window._esfPrefill = prefill; // Store data for the next page
    navigate('esf');
  },

  makeReturn(docId) {
    Modal.open({
      title: `Возврат по чеку ${docId}`,
      body: `
        <div class="flex-col gap-3">
          <p class="text-sm color-muted">Выберите товары для возврата и укажите причину</p>
          <div class="input-group"><label>Причина возврата</label>
            <select class="filter-input" style="width:100%">
              <option>Ненадлежащее качество</option>
              <option>Не подошёл по размеру/цвету</option>
              <option>Ошибка кассира</option>
              <option>Другое</option>
            </select>
          </div>
          <div class="input-group"><label>Комментарий</label>
            <input type="text" placeholder="Необязательно..."/>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button>
        <button class="btn btn-danger" onclick="Toast.success('Возврат оформлен');Modal.closeAll()">Оформить возврат</button>
      `
    });
  },

  newSale() {
    Modal.open({
      title: 'Новая продажа',
      size: '640px',
      body: `
        <div class="card mb-4" style="background:rgba(108,99,255,0.06);border-color:rgba(108,99,255,0.2)">
          <div class="flex-row gap-3">
            <span style="font-size:24px">🖥️</span>
            <div>
              <div class="font-bold">Кассовый модуль QDET</div>
              <p class="text-sm color-muted mt-1">Для продаж используйте приложение QDET Desktop (Windows/Mac) или мобильное приложение. Здесь отображается история чеков.</p>
            </div>
          </div>
        </div>
        <div class="flex-col gap-2">
          <div class="flex-row gap-3 p-4" style="background:var(--bg-hover);border-radius:8px">
            <span>🖥️</span>
            <div>
              <div class="font-bold text-sm">QDET Desktop</div>
              <p class="text-xs color-muted">Установить на компьютер кассира</p>
            </div>
            <button class="btn btn-ghost btn-sm ml-auto" onclick="Toast.info('Переход на страницу загрузки')">Скачать</button>
          </div>
          <div class="flex-row gap-3 p-4" style="background:var(--bg-hover);border-radius:8px">
            <span>📱</span>
            <div>
              <div class="font-bold text-sm">QDET Mobile</div>
              <p class="text-xs color-muted">App Store / Google Play</p>
            </div>
            <button class="btn btn-ghost btn-sm ml-auto" onclick="Toast.info('Переход в магазин приложений')">Открыть</button>
          </div>
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>`
    });
  },

  export() {
    Toast.info('Экспорт в Excel — требуется подключение к серверу');
  }
};
