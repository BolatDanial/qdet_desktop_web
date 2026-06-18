// Stub files for remaining pages
window.Pages.purchases = {
  _list: [],
  _limit: 10,
  _offset: 0,

  render() {
    return `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Закупки</h1>
            <p class="page-subtitle">Реестр приходных накладных и закупок</p>
          </div>
        </div>

        <div class="card mt-4">
          <div class="flex-row gap-2 mb-4 align-center justify-between">
            <div class="flex-row gap-2">
              <span class="font-bold text-sm">Список документов</span>
            </div>
            <div class="flex-row gap-2">
              <button class="btn btn-ghost btn-sm" onclick="window.Pages.purchases.refresh()">
                🔄 Обновить
              </button>
            </div>
          </div>

          <div id="purchases-list-container" style="overflow-x: auto;">
            <div class="spinner-ring" style="margin:40px auto"></div>
          </div>

          <!-- Pagination -->
          <div class="flex-row justify-between align-center mt-4">
            <div class="text-xs color-muted" id="purchases-page-info">Показано 0-0</div>
            <div class="flex-row gap-2">
              <button class="btn btn-ghost btn-sm" id="btn-purchase-prev" onclick="window.Pages.purchases.prevPage()" disabled>Назад</button>
              <button class="btn btn-ghost btn-sm" id="btn-purchase-next" onclick="window.Pages.purchases.nextPage()" disabled>Вперед</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this._offset = 0;
    await this.load();
  },

  async refresh() {
    await this.load();
  },

  async prevPage() {
    if (this._offset >= this._limit) {
      this._offset -= this._limit;
      await this.load();
    }
  },

  async nextPage() {
    if (this._list.length === this._limit) {
      this._offset += this._limit;
      await this.load();
    }
  },

  async load() {
    const container = document.getElementById('purchases-list-container');
    if (!container) return;
    container.innerHTML = '<div class="spinner-ring" style="margin:40px auto"></div>';

    try {
      const response = await API.purchases.getDocuments({ limit: this._limit, offset: this._offset });
      
      this._list = (response && response.data) ? response.data : [];

      if (!this._list.length) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px;" class="color-muted">
            📦 Нет документов закупки
          </div>
        `;
        this._updatePaginationUI(false);
        return;
      }

      this._renderList(container);
      this._updatePaginationUI(true);
    } catch (e) {
      console.error('Error loading purchases:', e);
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px;" class="color-red">
          ❌ Ошибка при загрузке данных: ${e.message || e}
        </div>
      `;
      this._updatePaginationUI(false);
    }
  },

  _updatePaginationUI(hasData) {
    const prevBtn = document.getElementById('btn-purchase-prev');
    const nextBtn = document.getElementById('btn-purchase-next');
    const infoEl = document.getElementById('purchases-page-info');

    if (prevBtn) prevBtn.disabled = this._offset === 0;
    if (nextBtn) nextBtn.disabled = !hasData || this._list.length < this._limit;

    if (infoEl) {
      const from = this._offset + 1;
      const to = this._offset + this._list.length;
      infoEl.textContent = hasData ? `Показаны документы ${from}–${to}` : 'Нет документов';
    }
  },

  _renderList(container) {
    const html = `
      <table class="table" style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 13px;">
            <th style="padding: 12px 8px;">№ Документа</th>
            <th style="padding: 12px 8px;">Дата</th>
            <th style="padding: 12px 8px;">Поставщик</th>
            <th style="padding: 12px 8px;">Склад</th>
            <th style="padding: 12px 8px;">Статус</th>
            <th style="padding: 12px 8px; text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${this._list.map(doc => {
            const statusClass = doc.status_name === 'Проведен' ? 'badge-success' : 'badge-warning';
            return `
              <tr style="border-bottom: 1px solid var(--border-color); font-size: 14px;" class="table-row-hover">
                <td style="padding: 12px 8px; font-weight: bold;">
                  ${doc.doc_id ? doc.doc_id.substring(0, 8) : '—'}
                </td>
                <td style="padding: 12px 8px;">
                  ${doc.doc_date ? fmtDateTime(doc.doc_date) : '—'}
                </td>
                <td style="padding: 12px 8px; font-weight: 500;">
                  ${doc.supplier_name || '—'}
                </td>
                <td style="padding: 12px 8px; color: var(--text-muted);">
                  ${doc.warehouse_name || '—'}
                </td>
                <td style="padding: 12px 8px;">
                  <span class="badge ${statusClass}">${doc.status_name || '—'}</span>
                </td>
                <td style="padding: 12px 8px; text-align: right;">
                  <button class="btn btn-ghost btn-sm" onclick="window.Pages.purchases.viewDetails('${doc.doc_id}')">
                    Открыть
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  },

  async viewDetails(docId) {
    const loadId = Modal.open({
      title: `Накладная закупки`,
      size: '720px',
      body: `<div class="spinner-ring" style="margin:40px auto"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>`
    });

    try {
      const response = await API.purchases.getDetails(docId);
      const items = (response && response.data) ? response.data : [];

      Modal.close(loadId);

      if (!items.length) {
        Modal.open({
          title: `Накладная закупки`,
          size: '720px',
          body: `<p class="color-muted p-4" style="text-align:center;">Нет позиций в этом документе закупки</p>`,
          footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>`
        });
        return;
      }

      let totalCostSum = 0;
      let totalQty = 0;
      items.forEach(it => {
        totalCostSum += (it.qty || 0) * (it.cost_price || 0);
        totalQty += (it.qty || 0);
      });

      const bodyHtml = `
        <div class="flex-col gap-3">
          <div class="card" style="background:var(--bg-hover)">
            <div class="grid-2">
              <div>
                <span class="color-muted text-xs">Позиций:</span>
                <div class="font-bold text-lg">${items.length}</div>
              </div>
              <div>
                <span class="color-muted text-xs">Всего товаров:</span>
                <div class="font-bold text-lg">${totalQty}</div>
              </div>
              <div class="mt-2">
                <span class="color-muted text-xs">Сумма закупа:</span>
                <div class="font-bold text-lg color-green">${fmt(totalCostSum)}</div>
              </div>
            </div>
          </div>

          <div style="border-top:1px solid var(--border-color); margin-top:10px; padding-top:12px;">
            <div class="font-bold text-xs color-muted mb-2">СПИСОК ТОВАРОВ</div>
            <div style="max-height: 350px; overflow-y: auto; border-radius: 8px; background: rgba(0, 0, 0, 0.2); padding: 8px;">
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-align: left;">
                    <th style="padding: 8px 4px;">Товар</th>
                    <th style="padding: 8px 4px; text-align: right; width: 60px;">Кол-во</th>
                    <th style="padding: 8px 4px; text-align: right; width: 90px;">Цена закупа</th>
                    <th style="padding: 8px 4px; text-align: right; width: 90px;">Цена розница</th>
                    <th style="padding: 8px 4px; text-align: right; width: 100px;">Сумма закупа</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => {
                    const costTotal = (it.qty || 0) * (it.cost_price || 0);
                    return `
                      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding: 8px 4px; max-width: 250px;">
                          <div class="font-bold" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${it.good_name}">
                            ${it.good_name}
                          </div>
                          ${it.barcode ? `<span style="font-size: 11px; color: var(--text-muted);">${it.barcode}</span>` : ''}
                        </td>
                        <td style="padding: 8px 4px; text-align: right; font-weight: bold;">
                          ${it.qty} <span style="font-weight:normal; font-size:11px; color:var(--text-muted);">${it.unit_name || ''}</span>
                        </td>
                        <td style="padding: 8px 4px; text-align: right; color: var(--text-muted);">
                          ${fmt(it.cost_price)}
                        </td>
                        <td style="padding: 8px 4px; text-align: right; color: var(--text-muted);">
                          ${fmt(it.retail_price)}
                        </td>
                        <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: var(--text-primary);">
                          ${fmt(costTotal)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      Modal.open({
        title: `Накладная закупки №${docId.substring(0, 8)}`,
        size: '720px',
        body: bodyHtml,
        footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>`
      });
    } catch (e) {
      Modal.close(loadId);
      console.error('Error loading purchase details:', e);
      Modal.open({
        title: `Ошибка`,
        body: `<p class="color-red p-4">Не удалось загрузить детали документа: ${e.message || e}</p>`,
        footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>`
      });
    }
  }
};
window.Pages.clients = window.Pages.clients || { render(){ return '<div class="fade-in"><h1 class="page-title">Клиенты</h1></div>'; }, init(){} };
window.Pages.reports = window.Pages.reports || { render(){ return '<div class="fade-in"><h1 class="page-title">Отчёты</h1></div>'; }, init(){} };
window.Pages.warehouse = window.Pages.warehouse || { render(){ return '<div class="fade-in"><h1 class="page-title">Остатки</h1></div>'; }, init(){} };
window.Pages.audit = window.Pages.audit || { render(){ return '<div class="fade-in"><h1 class="page-title">Инвентаризация</h1></div>'; }, init(){} };
window.Pages.sales = window.Pages.sales || { render(){ return '<div class="fade-in"><h1 class="page-title">Продажи</h1></div>'; }, init(){} };
window.Pages.kaspi = window.Pages.kaspi || { render(){ return '<div class="fade-in"><h1 class="page-title">Kaspi</h1></div>'; }, init(){} };
window.Pages.wb = window.Pages.wb || { render(){ return '<div class="fade-in"><h1 class="page-title">Wildberries</h1></div>'; }, init(){} };
window.Pages.settings = window.Pages.settings || { render(){ return '<div class="fade-in"><h1 class="page-title">Настройки</h1></div>'; }, init(){} };
