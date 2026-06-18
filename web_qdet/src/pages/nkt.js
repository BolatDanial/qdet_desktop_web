// НКТ — National Product Catalog of Kazakhstan
window.Pages.nkt = {
  _currentTab: 'search', // 'search' or 'wizard'
  _unmappedGoods: [],
  _selectedGood: null,

  render() {
    return `
    <div class="fade-in">
      <div class="page-header flex-row" style="justify-content: space-between; align-items: center;">
        <div>
          <h1 class="page-title">🔍 НКТ — Национальный каталог товаров</h1>
          <p class="page-subtitle">Поиск товаров и сопоставление кодов для ЭСФ</p>
        </div>
        <div class="flex-row gap-2">
          <button class="btn ${this._currentTab === 'search' ? 'btn-primary' : 'btn-ghost'}" onclick="window.Pages.nkt.switchTab('search')">Поиск по каталогу</button>
          <button class="btn ${this._currentTab === 'wizard' ? 'btn-primary' : 'btn-ghost'}" onclick="window.Pages.nkt.switchTab('wizard')">Мастер сопоставления</button>
          <a href="https://nationalcatalog.kz" target="_blank" class="btn btn-ghost btn-sm">nationalcatalog.kz →</a>
        </div>
      </div>

      <div id="nkt-server-banner" class="card mb-4" style="display:none;background:rgba(255,154,60,0.06);border-color:rgba(255,154,60,0.25)">
        <div class="flex-row gap-3">
          <span style="font-size:22px">⚠️</span>
          <div>
            <div class="font-bold text-sm">Сервер недоступен</div>
            <p class="text-xs color-muted mt-1">Запустите QDET backend: <code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px">uvicorn main:app --reload</code>, затем обновите страницу.</p>
          </div>
          <button class="btn btn-ghost btn-sm ml-auto" onclick="window.Pages.nkt.checkServer()">Проверить</button>
        </div>
      </div>

      <div id="nkt-tab-content">
        ${this._currentTab === 'search' ? this.renderSearchTab() : this.renderWizardTab()}
      </div>
    </div>`;
  },

  renderSearchTab() {
    return `
      <div class="card mb-6">
        <div class="card-title mb-4">Поиск товара</div>
        <div class="nkt-search-box">
          <input type="text" id="nkt-query" placeholder="Введите штрихкод (EAN-13, ITF-14) или наименование товара..."
                 onkeydown="if(event.key==='Enter') window.Pages.nkt.search()" />
          <button class="btn btn-primary" onclick="window.Pages.nkt.search()" id="nkt-search-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Найти
          </button>
        </div>
      </div>

      <div id="nkt-result"></div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">История поиска</div>
          <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.clearHistory()">Очистить</button>
        </div>
        <div id="nkt-history">${this.renderHistory()}</div>
      </div>`;
  },

  renderWizardTab() {
    return `
      <div class="card mb-6">
        <div class="card-header flex-row" style="justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div class="card-title">Товары, требующие сопоставления НКТ</div>
          <div class="flex-row gap-2">
            <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.clearFailedCache()">Сбросить кэш ошибок</button>
            <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.loadUnmapped()">Обновить список</button>
            <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.startAutoMapping()">⚡ Авто-сопоставление</button>
          </div>
        </div>
        <p class="text-sm color-muted mb-4">
          Ниже выведены товары из локальной базы данных, для которых не заданы коды НТИН.
          Нажмите <b>«Сопоставить»</b>, чтобы выполнить поиск по коду/названию в НКТ или ввести коды вручную для использования в ЭСФ.
        </p>
        <div id="nkt-unmapped-list">
          <div style="text-align:center;padding:20px">
            <div class="spinner-ring" style="margin:0 auto"></div>
          </div>
        </div>
      </div>`;
  },

  switchTab(tab) {
    this._currentTab = tab;
    navigate('nkt');
  },

  fillExample(code) {
    document.getElementById('nkt-query').value = code;
    this.search();
  },

  getHistory() { return Store.get('nkt_history') || []; },
  saveHistory(item) {
    const h = this.getHistory().filter(x => x.barcode !== item.barcode);
    h.unshift(item);
    Store.set('nkt_history', h.slice(0, 20));
  },
  clearHistory() {
    Store.del('nkt_history');
    const el = document.getElementById('nkt-history');
    if (el) el.innerHTML = '<p class="color-muted text-sm p-4">История пуста</p>';
  },

  renderHistory() {
    const h = this.getHistory();
    if (!h.length) return '<p class="color-muted text-sm p-4">История пуста</p>';
    return buildTable([
      { key: 'barcode', label: 'Штрихкод' },
      { key: 'good_name', label: 'Наименование (RU)' },
      { key: 'vendor', label: 'Бренд' },
      { key: 'country', label: 'Страна' },
      { key: 'ntin', label: 'НТИН' },
    ], h, {
      actionsFn: r => `
        <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.fillExample('${r.barcode}')">Повторить</button>
        <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.importToGoods('${r.barcode}')">Импорт</button>
      `
    });
  },

  async checkServer() {
    try {
      const r = await fetch(`${window.urlServer || ''}/api/docs`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        Toast.success('Сервер доступен! Перезагрузите страницу.');
        const b = document.getElementById('nkt-server-banner');
        if (b) b.style.display = 'none';
      }
    } catch { Toast.error('Сервер всё ещё недоступен'); }
  },

  async search() {
    const q = document.getElementById('nkt-query').value.trim();
    if (!q) { Toast.error('Введите штрихкод или наименование'); return; }

    const btn = document.getElementById('nkt-search-btn');
    btn.disabled = true;
    document.getElementById('nkt-result').innerHTML = `
      <div class="card mb-4" style="text-align:center;padding:40px">
        <div class="spinner-ring" style="margin:0 auto 16px"></div>
        <p class="color-muted">Запрос в НКТ...</p>
      </div>`;

    try {
      const data = await API.nkt.searchByBarcode(q);
      const banner = document.getElementById('nkt-server-banner');
      if (banner) banner.style.display = 'none';

      if (!data || (!data.good_name && !data.barcode)) {
        this._showNotFound(q);
        return;
      }
      this.saveHistory(data);
      this.renderResult(data, false);
    } catch (e) {
      const banner = document.getElementById('nkt-server-banner');
      if (banner) banner.style.display = '';

      if (e.message && e.message.toLowerCase().includes('fetch')) {
        this._showServerError(q);
      } else {
        document.getElementById('nkt-result').innerHTML = `
          <div class="card mb-4">
            <p class="color-red p-4">Ошибка: ${e.message}</p>
          </div>`;
      }
    } finally {
      btn.disabled = false;
    }
  },

  _showNotFound(q) {
    document.getElementById('nkt-result').innerHTML = `
      <div class="card mb-4">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Товар не найден</h3>
          <p>Штрихкод <b>${q}</b> отсутствует в НКТ и локальной базе</p>
        </div>
      </div>`;
  },

  _showServerError(q) {
    document.getElementById('nkt-result').innerHTML = `
      <div class="card mb-4" style="border-color:rgba(255,154,60,0.3)">
        <div style="padding:8px">
          <div class="flex-row gap-3 mb-3">
            <span style="font-size:28px">🔌</span>
            <div>
              <div class="font-bold">Сервер QDET недоступен</div>
              <p class="text-sm color-muted mt-1">НКТ-поиск работает через бэкенд. Запустите сервер и попробуйте снова.</p>
            </div>
          </div>
          <div class="card" style="background:var(--bg-primary);font-family:monospace;font-size:12px;padding:12px">
            cd /путь/к/qdet<br>
            uvicorn main:app --reload --port 8000
          </div>
          <div class="flex-row gap-2 mt-3">
            <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.search()">Повторить</button>
            <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.checkServer()">Проверить сервер</button>
          </div>
        </div>
      </div>`;
  },

  renderResult(d) {
    document.getElementById('nkt-result').innerHTML = `
      <div class="nkt-result-card mb-4 fade-in">
        <div class="nkt-result-header">
          ${d.photo
        ? `<img class="nkt-photo" src="${d.photo}" onerror="this.style.display='none'" alt="фото"/>`
        : `<div class="nkt-photo" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:32px">📦</div>`}
          <div class="nkt-info" style="flex:1">
            <h3>${d.good_name || '—'}</h3>
            <p class="color-muted text-sm">${d.good_name_kz || ''}</p>
            <div class="nkt-meta">
              ${d.vendor ? `<span class="badge badge-info">🏷 ${d.vendor}</span>` : ''}
              ${d.country ? `<span class="badge badge-muted">🌍 ${d.country}</span>` : ''}
              ${d.category ? `<span class="badge badge-muted">📂 ${d.category}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="grid-2 mt-4">
          <div>
            <p class="text-xs color-muted">ШТРИХКОД</p>
            <p class="font-bold">${d.barcode || '—'}</p>
          </div>
          <div>
            <p class="text-xs color-muted">НТИН (национальный номер)</p>
            <p class="font-bold color-accent">${d.ntin || '—'}</p>
          </div>
          ${d.full_name_ru ? `<div><p class="text-xs color-muted">ПОЛНОЕ НАИМЕНОВАНИЕ (RU)</p><p class="text-sm">${d.full_name_ru}</p></div>` : ''}
          ${d.full_name_kz ? `<div><p class="text-xs color-muted">ПОЛНОЕ НАИМЕНОВАНИЕ (KZ)</p><p class="text-sm">${d.full_name_kz}</p></div>` : ''}
        </div>
        <div class="flex-row mt-4 gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.importToGoods('${d.barcode}')">
            + Добавить в товары
          </button>
          <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.copyNtin('${d.ntin}')">
            Копировать НТИН
          </button>
          <button class="btn btn-ghost btn-sm" onclick="window.Pages.nkt.copyBarcode('${d.barcode}')">
            Копировать штрихкод
          </button>
        </div>
      </div>`;
    const histEl = document.getElementById('nkt-history');
    if (histEl) histEl.innerHTML = this.renderHistory();
  },

  copyNtin(ntin) {
    if (!ntin || ntin === 'null' || ntin === 'undefined') { Toast.error('НТИН отсутствует'); return; }
    navigator.clipboard.writeText(ntin).then(() => Toast.success('НТИН скопирован: ' + ntin)).catch(() => Toast.error('Ошибка копирования'));
  },

  copyBarcode(bc) {
    if (!bc) return;
    navigator.clipboard.writeText(bc).then(() => Toast.success('Штрихкод скопирован')).catch(() => { });
  },

  importToGoods(barcode) {
    const item = this.getHistory().find(x => x.barcode === barcode);
    if (!item) { Toast.error('Данные товара не найдены'); return; }
    Modal.open({
      title: 'Добавить в товары',
      body: `
        <div class="flex-col gap-3">
          <p class="text-sm color-muted">Данные из НКТ будут использованы для создания карточки товара</p>
          <div class="card" style="background:var(--bg-hover)">
            <div class="font-bold">${item.good_name}</div>
            <div class="text-sm color-muted mt-1">Штрихкод: ${item.barcode} · НТИН: ${item.ntin || '—'}</div>
          </div>
          <div class="input-group"><label>Цена продажи (₸)</label><input type="number" id="nkt-imp-price" placeholder="0"/></div>
          <div class="input-group"><label>Цена закупки (₸)</label><input type="number" id="nkt-imp-cost" placeholder="0"/></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button>
        <button class="btn btn-primary" onclick="Toast.success('Товар добавлен в базу');Modal.closeAll()">Добавить</button>`
    });
  },

  // ── MAPPING WIZARD METHODS ──────────────────────────────────────────────────
  _wizardResults: [],

  async loadUnmapped() {
    const listEl = document.getElementById('nkt-unmapped-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="text-align:center;padding:30px">
        <div class="spinner-ring" style="margin:0 auto 12px"></div>
        <p class="color-muted">Загрузка товаров из базы данных...</p>
      </div>`;

    try {
      const goods = await API.nkt.getUnmapped(50, [], false);
      this._unmappedGoods = goods || [];

      if (!this._unmappedGoods.length) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding: 40px 20px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3 class="mt-3">Все товары сопоставлены!</h3>
            <p class="color-muted">В базе данных нет товаров без кодов НТИН.</p>
          </div>`;
        return;
      }

      listEl.innerHTML = buildTable([
        { key: 'good_name', label: 'Наименование товара' },
        { key: 'good_barcode', label: 'Штрихкод в БД' },
        { key: 'good_category', label: 'Категория' },
      ], this._unmappedGoods, {
        actionsFn: r => `
          <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.openMappingWizard('${r.good_id}')">
            Сопоставить
          </button>
        `
      });
    } catch (e) {
      listEl.innerHTML = `<p class="color-red p-4">Ошибка загрузки списка: ${e.message}</p>`;
    }
  },

  openMappingWizard(goodId) {
    const good = this._unmappedGoods.find(x => x.good_id === goodId);
    if (!good) return;

    this._selectedGood = good;

    Modal.open({
      title: `Сопоставление: ${good.good_name}`,
      body: `
        <div class="flex-col gap-4">
          <div class="card" style="background:var(--bg-hover); padding:12px; border-radius:8px;">
            <div class="text-xs color-muted font-bold">ДАННЫЕ ТОВАРА ИЗ ЛОКАЛЬНОЙ БД</div>
            <div class="font-bold mt-1" style="font-size:15px">${good.good_name}</div>
            <div class="text-sm color-muted mt-1">Штрихкод: ${good.good_barcode || 'отсутствует'}</div>
          </div>
          
          <div class="input-group">
            <label>Поисковый запрос для НКТ</label>
            <div class="nkt-search-box">
              <input type="text" id="nkt-wiz-query" value="${good.good_barcode || good.good_name}" placeholder="Штрихкод или наименование..." />
              <button class="btn btn-primary" onclick="window.Pages.nkt.searchInWizard()">Найти</button>
            </div>
          </div>
          
          <div id="nkt-wiz-results" style="max-height: 250px; overflow-y: auto; background: var(--bg-hover); border-radius: 8px; padding: 8px; border: 1px solid var(--border-color);">
            <p class="text-sm color-muted" style="text-align:center;padding:20px">Нажмите «Найти» для поиска в каталоге НКТ</p>
          </div>
          
          <div style="border-top:1px solid var(--bg-hover);margin:10px 0"></div>
          
          <div class="card" style="background:rgba(255,255,255,0.01);padding:14px;border:1px dashed var(--border-color);border-radius:8px;">
            <div class="font-bold text-sm mb-3">Ручной ввод кодов (если нет в НКТ)</div>
            <div class="grid-2 gap-3">
              <div class="input-group">
                <label>НТИН код</label>
                <input type="text" id="nkt-wiz-manual-ntin" placeholder="Например, 10000172345" />
              </div>
              <div class="input-group">
                <label>Штрихкод</label>
                <input type="text" id="nkt-wiz-manual-barcode" value="${good.good_barcode || ''}" />
              </div>
              <div class="input-group">
                <label>Код ТН ВЭД</label>
                <input type="text" id="nkt-wiz-manual-tnved" value="3004900002" />
              </div>
              <div class="input-group">
                <label>Код происхождения</label>
                <input type="text" id="nkt-wiz-manual-origin" value="5" />
              </div>
              <div class="input-group">
                <label>Вендор (Бренд)</label>
                <input type="text" id="nkt-wiz-manual-vendor" value="${good.vendor || ''}" placeholder="Бренд товара..." />
              </div>
              <div class="input-group">
                <label>Описание (RU)</label>
                <input type="text" id="nkt-wiz-manual-desc" value="${good.description || good.good_name || ''}" placeholder="Описание..." />
              </div>
              <div class="input-group" style="grid-column: span 2">
                <label>Описание (KZ)</label>
                <input type="text" id="nkt-wiz-manual-desc-kz" value="${good.description_kz || ''}" placeholder="Сипаттамасы..." />
              </div>
            </div>
            <button class="btn btn-ghost btn-sm mt-3 btn-full" onclick="window.Pages.nkt.saveManualMapping()">
              Применить ручной ввод
            </button>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button>
      `
    });

    // Auto-trigger search in wizard if it has barcode
    if (good.good_barcode) {
      setTimeout(() => this.searchInWizard(), 200);
    }
  },

  fillWizFields(item) {
    if (!item) return;
    const ntinEl = document.getElementById('nkt-wiz-manual-ntin');
    const vendorEl = document.getElementById('nkt-wiz-manual-vendor');
    const descEl = document.getElementById('nkt-wiz-manual-desc');
    const descKzEl = document.getElementById('nkt-wiz-manual-desc-kz');

    if (ntinEl && item.ntin) ntinEl.value = item.ntin;
    if (vendorEl && item.vendor) vendorEl.value = item.vendor;
    if (descEl) descEl.value = item.full_name_ru || item.good_name || '';
    if (descKzEl) descKzEl.value = item.full_name_kz || item.good_name_kz || '';
  },

  async searchInWizard() {
    const q = document.getElementById('nkt-wiz-query').value.trim();
    const resultsEl = document.getElementById('nkt-wiz-results');
    if (!q || !resultsEl) return;

    resultsEl.innerHTML = `
      <div style="text-align:center;padding:20px">
        <div class="spinner-ring" style="margin:0 auto 10px;width:24px;height:24px"></div>
        <p class="text-xs color-muted">Поиск в НКТ...</p>
      </div>`;

    try {
      let results = [];
      // 1. If it looks like a barcode, search by barcode
      if (/^\d+$/.test(q)) {
        try {
          const item = await API.nkt.searchByBarcode(q);
          if (item && item.good_name) {
            results = [item];
          }
        } catch { }
      }

      // 2. If no barcode result, search by name in local index
      if (!results.length) {
        const nameResults = await API.nkt.searchByName(q);
        results = nameResults || [];
      }

      this._wizardResults = results || [];

      if (!results.length) {
        resultsEl.innerHTML = '<p class="text-sm color-red" style="text-align:center;padding:20px">Ничего не найдено в НКТ</p>';
        return;
      }

      // Automatically prefill the manual input fields with the first result
      this.fillWizFields(results[0]);

      resultsEl.innerHTML = results.map(r => `
        <div class="flex-row gap-3 p-3 mb-2" style="background:var(--bg-primary);border-radius:6px;border:1px solid var(--border-color);align-items:center; justify-content: space-between;">
          <div style="flex:1;min-width:0;text-align:left;">
            <div class="font-bold text-sm truncate" style="color:var(--text-primary)">${r.good_name}</div>
            <div class="text-xs color-muted mt-1">
              Штрихкод: <b>${r.barcode}</b> · НТИН: <b class="color-accent">${r.ntin || '—'}</b>
            </div>
            <div class="text-xs color-muted truncate mt-1">
              Бренд: ${r.vendor || '—'} · Страна: ${r.country || '—'}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.Pages.nkt.selectWizResult('${r.barcode}')">
            Выбрать
          </button>
        </div>
      `).join('');

    } catch (e) {
      resultsEl.innerHTML = `<p class="text-sm color-red" style="text-align:center;padding:20px">Ошибка поиска: ${e.message}</p>`;
    }
  },

  async selectWizResult(barcode) {
    if (!this._selectedGood) return;
    const item = this._wizardResults.find(x => x.barcode === barcode);
    if (!item) return;

    // Prefill fields to ensure visual consistency
    this.fillWizFields(item);

    try {
      await API.nkt.mapGood({
        good_id: this._selectedGood.good_id,
        barcode: item.barcode,
        ntin: item.ntin || "10000000000",
        tnved: "3004900002",
        tru_origin_code: "5",
        description: item.full_name_ru || item.good_name || null,
        description_kz: item.full_name_kz || item.good_name_kz || null,
        vendor: item.vendor || null,
        good_name_kz: item.good_name_kz || item.full_name_kz || null
      });
      Toast.success('Товар успешно сопоставлен!');
      Modal.closeAll();
      this.loadUnmapped();
    } catch (e) {
      Toast.error('Ошибка сохранения: ' + e.message);
    }
  },

  async saveManualMapping() {
    if (!this._selectedGood) return;
    const ntin = document.getElementById('nkt-wiz-manual-ntin').value.trim();
    const barcode = document.getElementById('nkt-wiz-manual-barcode').value.trim();
    const tnved = document.getElementById('nkt-wiz-manual-tnved').value.trim();
    const origin = document.getElementById('nkt-wiz-manual-origin').value.trim();
    const vendor = document.getElementById('nkt-wiz-manual-vendor').value.trim();
    const desc = document.getElementById('nkt-wiz-manual-desc').value.trim();
    const descKz = document.getElementById('nkt-wiz-manual-desc-kz').value.trim();

    if (!ntin) { Toast.error('Введите НТИН'); return; }
    if (!barcode) { Toast.error('Введите штрихкод'); return; }

    try {
      await API.nkt.mapGood({
        good_id: this._selectedGood.good_id,
        barcode,
        ntin,
        tnved,
        tru_origin_code: origin,
        description: desc || null,
        description_kz: descKz || null,
        vendor: vendor || null,
        good_name_kz: descKz || null
      });
      Toast.success('Ручное сопоставление успешно сохранено!');
      Modal.closeAll();
      this.loadUnmapped();
    } catch (e) {
      Toast.error('Ошибка сохранения: ' + e.message);
    }
  },

  async startAutoMapping() {
    if (!this._failedBarcodes) {
      this._failedBarcodes = new Set(Store.get('nkt_failed_barcodes') || []);
    }

    Modal.open({
      title: 'Автоматическое сопоставление НКТ',
      onClose: () => {
        this._autoMappingActive = false;
        this.loadUnmapped();
      },
      body: `
        <div class="flex-col gap-4">
          <p class="text-sm color-muted">Система загрузит список несопоставленных товаров и автоматически выполнит поиск по штрихкоду в НКТ.</p>
          
          <div class="card p-3" style="background:var(--bg-hover); border: 1px solid var(--border-color); border-radius: 8px;">
            <div class="flex-row justify-between mb-2">
              <span class="text-xs color-muted font-bold">ОБРАБОТАНО</span>
              <span class="text-xs font-bold" id="nkt-auto-progress-text">0 товаров</span>
            </div>
            <div style="width:100%;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
              <div id="nkt-auto-progress-bar" style="width:0%;height:100%;background:var(--color-primary, #6366f1);transition:width 0.2s"></div>
            </div>
          </div>
          
          <div class="grid-3 gap-2 text-center" style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div class="card p-2" style="background:rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px;">
              <div class="text-xs color-muted">Сопоставлено</div>
              <div class="text-lg font-bold" style="color:#22c55e" id="nkt-auto-cnt-success">0</div>
            </div>
            <div class="card p-2" style="background:rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px;">
              <div class="text-xs color-muted">Не найдено</div>
              <div class="text-lg font-bold" style="color:#ef4444" id="nkt-auto-cnt-failed">0</div>
            </div>
            <div class="card p-2" style="background:var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px;">
              <div class="text-xs color-muted">Пропущено / Кэш</div>
              <div class="text-lg font-bold color-muted" id="nkt-auto-cnt-skipped">0 (кэш: ${this._failedBarcodes.size})</div>
            </div>
          </div>
          
          <div id="nkt-auto-status-text" class="text-xs color-muted text-center font-bold">Загрузка товаров...</div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" id="nkt-auto-close-btn" onclick="window.Pages.nkt.stopAutoMapping()">Остановить</button>
      `
    });

    this._autoMappingActive = true;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;

    const progressText = document.getElementById('nkt-auto-progress-text');
    const progressBar = document.getElementById('nkt-auto-progress-bar');
    const successVal = document.getElementById('nkt-auto-cnt-success');
    const failedVal = document.getElementById('nkt-auto-cnt-failed');
    const skippedVal = document.getElementById('nkt-auto-cnt-skipped');
    const statusText = document.getElementById('nkt-auto-status-text');

    if (progressText) progressText.innerText = '0 товаров';

    const updateSkippedCountText = () => {
      if (skippedVal) {
        skippedVal.innerText = `${skippedCount} (кэш: ${this._failedBarcodes.size})`;
      }
    };

    while (this._autoMappingActive) {
      if (statusText) statusText.innerText = 'Загрузка следующей порции товаров из БД...';
      
      let goods = [];
      try {
        const exclude = Array.from(this._failedBarcodes);
        goods = await API.nkt.getUnmapped(100, exclude, true);
      } catch (e) {
        if (statusText) statusText.innerHTML = `<span class="color-red">Ошибка загрузки: ${e.message}</span>`;
        break;
      }

      if (!goods || !goods.length) {
        break; // No more unmapped goods with barcodes that are not failed
      }

      for (let i = 0; i < goods.length; i++) {
        if (!this._autoMappingActive) break;

        const g = goods[i];
        processedCount++;

        if (statusText) statusText.innerText = `Обработка: ${g.good_name}`;
        if (progressText) progressText.innerText = `${processedCount} товаров`;
        
        const pct = Math.round(((i + 1) / goods.length) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;

        // Safety check (should not happen since backend filters them)
        if (!g.good_barcode || this._failedBarcodes.has(g.good_barcode)) {
          skippedCount++;
          updateSkippedCountText();
          continue;
        }

        // Perform NKT search and mapping
        try {
          const item = await API.nkt.searchByBarcode(g.good_barcode);
          if (item && item.good_name && item.ntin) {
            await API.nkt.mapGood({
              good_id: g.good_id,
              barcode: item.barcode,
              ntin: item.ntin,
              tnved: item.tnved || "3004900002",
              tru_origin_code: item.tru_origin_code || "5",
              description: item.full_name_ru || item.good_name || null,
              description_kz: item.full_name_kz || item.good_name_kz || null,
              vendor: item.vendor || null,
              good_name_kz: item.good_name_kz || item.full_name_kz || null
            });
            successCount++;
            if (successVal) successVal.innerText = successCount;
          } else {
            failedCount++;
            if (failedVal) failedVal.innerText = failedCount;
            this._failedBarcodes.add(g.good_barcode);
            Store.set('nkt_failed_barcodes', Array.from(this._failedBarcodes));
            updateSkippedCountText();
          }
        } catch (e) {
          failedCount++;
          if (failedVal) failedVal.innerText = failedCount;
          this._failedBarcodes.add(g.good_barcode);
          Store.set('nkt_failed_barcodes', Array.from(this._failedBarcodes));
          updateSkippedCountText();
        }

        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (statusText) {
      statusText.innerText = this._autoMappingActive 
        ? `Готово! Успешно: ${successCount}, не найдено/ошибок: ${failedCount}, пропущено/кэш: ${skippedCount}`
        : 'Сопоставление остановлено.';
    }

    const closeBtn = document.getElementById('nkt-auto-close-btn');
    if (closeBtn) {
      closeBtn.innerText = 'Закрыть';
      closeBtn.classList.remove('btn-ghost');
      closeBtn.classList.add('btn-primary');
    }

    this.loadUnmapped();
  },

  stopAutoMapping() {
    this._autoMappingActive = false;
    Modal.closeAll();
  },

  clearFailedCache() {
    if (!this._failedBarcodes) {
      this._failedBarcodes = new Set();
    } else {
      this._failedBarcodes.clear();
    }
    Store.del('nkt_failed_barcodes');
    Toast.success('Кэш ошибок поиска НКТ очищен');
    this.loadUnmapped();
  },

  init() {
    if (this._currentTab === 'wizard') {
      this.loadUnmapped();
    }
  }
};
