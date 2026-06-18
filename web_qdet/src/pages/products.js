// Products page
window.Pages.products = {
  _items: [], _page: 1, _limit: 20,
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Товары</h1><p class="page-subtitle">Управление номенклатурой</p></div>
        <div class="flex-row gap-2">
          <button class="btn btn-ghost btn-sm" onclick="navigate('nkt')">🔍 Найти в НКТ</button>
          <button class="btn btn-primary" onclick="window.Pages.products.create()">+ Добавить товар</button>
        </div>
      </div>
      <div class="card">
        <div class="filters-bar">
          <input class="filter-input" placeholder="Поиск по названию, штрихкоду..." id="prod-search" oninput="window.Pages.products.search(this.value)" style="flex:1;min-width:200px"/>
          <select class="filter-input" id="prod-cat"><option value="">Все категории</option></select>
          <select class="filter-input" id="prod-empty">
            <option value="">Все поля</option>
            <option value="Photo">Без фото</option>
            <option value="Article">Без артикула</option>
            <option value="Category">Без категории</option>
          </select>
          <label class="flex-row gap-2 text-sm"><input type="checkbox" id="prod-stock" onchange="window.Pages.products.load()"/> Только в наличии</label>
        </div>
        <div id="prod-list"><div class="spinner-ring" style="margin:30px auto"></div></div>
        <div class="flex-row mt-4 gap-2" id="prod-pagination"></div>
      </div>
    </div>`;
  },
  async init() { await this.loadCats(); await this.load(); },
  async loadCats() {
    try {
      const cats = await API.admin.getCategories({ is_parents: true });
      const sel = document.getElementById('prod-cat');
      if (sel && cats) cats.forEach(c => sel.innerHTML += `<option value="${c.cat_id}">${c.cat_name}</option>`);
    } catch {}
  },
  async load() {
    const search = document.getElementById('prod-search')?.value;
    const category = document.getElementById('prod-cat')?.value;
    const empty_field = document.getElementById('prod-empty')?.value;
    const in_stock = document.getElementById('prod-stock')?.checked;
    try {
      const data = await API.admin.getProducts({ search, category, empty_field, in_stock, limit: this._limit, offset: (this._page-1)*this._limit });
      this._items = data || [];
      this.renderList();
    } catch(e) {
      document.getElementById('prod-list').innerHTML = `<p class="color-red p-4">Ошибка загрузки: ${e.message}</p>`;
    }
  },
  search(v) { clearTimeout(this._st); this._st = setTimeout(() => this.load(), 400); },
  renderList() {
    document.getElementById('prod-list').innerHTML = buildTable([
      { key:'photo_path', label:'Фото', render: r => r.photo_path && r.photo_path.includes('http') ? `<img src="${r.photo_path}_small.webp" style="width:40px;height:40px;border-radius:6px;object-fit:cover" onerror="this.style.opacity=0.2"/>` : '<div style="width:40px;height:40px;border-radius:6px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">📦</div>' },
      { key:'good_name', label:'Наименование', render: r => `<div class="font-bold">${r.good_name||'—'}</div><div class="text-xs color-muted">${r.good_article||''}</div>` },
      { key:'good_barcode', label:'Штрихкод' },
      { key:'cat_name', label:'Категория', render: r => r.cat_name ? `<span class="badge badge-muted">${r.cat_name}</span>` : '—' },
      { key:'brand_name', label:'Бренд', render: r => r.brand_name || '—' },
      { key:'filled', label:'Заполнен', render: r => r.filled ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-danger">✗</span>' },
    ], this._items, {
      actionsFn: r => `<button class="btn btn-ghost btn-sm" onclick="window.Pages.products.edit('${r.good_id}')">Изменить</button>`
    });
  },
  create() { Toast.info('Создание товара — в разработке'); },
  edit(id) { Toast.info(`Редактирование товара ${id}`); },
};

// Clients page
window.Pages.clients = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Клиенты</h1><p class="page-subtitle">База покупателей</p></div>
        <button class="btn btn-primary" onclick="window.Pages.clients.create()">+ Добавить клиента</button>
      </div>
      <div class="card">
        <div class="filters-bar"><input class="filter-input" placeholder="Поиск..." id="cli-search" oninput="window.Pages.clients.load()" style="flex:1"/></div>
        <div id="cli-list"><div class="spinner-ring" style="margin:30px auto"></div></div>
      </div>
    </div>`;
  },
  async init() { await this.load(); },
  async load() {
    try {
      const data = await API.sales.fetchClients();
      document.getElementById('cli-list').innerHTML = buildTable([
        { key:'client_name', label:'Имя' },
        { key:'phone_number', label:'Телефон' },
        { key:'iin', label:'ИИН' },
        { key:'address', label:'Адрес' },
        { key:'discount', label:'Скидка', render: r => r.discount ? `${r.discount}%` : '—' },
      ], data||[], {
        actionsFn: r => `<button class="btn btn-ghost btn-sm" onclick="window.Pages.clients.viewDebts('${r.client_id}')">Долги</button>`
      });
    } catch(e) {
      document.getElementById('cli-list').innerHTML = `<p class="color-muted p-4">Нет данных (подключите сервер)</p>`;
    }
  },
  create() {
    Modal.open({ title: 'Новый клиент', body: `
      <div class="flex-col gap-3">
        <div class="input-group"><label>Имя</label><input type="text" id="cli-name" placeholder="Иванов Иван"/></div>
        <div class="input-group"><label>Телефон</label><input type="tel" id="cli-phone" placeholder="+7 777 123 45 67"/></div>
        <div class="input-group"><label>ИИН</label><input type="text" id="cli-iin" placeholder="900101300411" maxlength="12"/></div>
        <div class="input-group"><label>Адрес</label><input type="text" id="cli-addr" placeholder="г. Алматы, ул. ..."/></div>
        <div class="input-group"><label>Скидка (%)</label><input type="number" id="cli-disc" min="0" max="100" value="0"/></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button><button class="btn btn-primary" onclick="Toast.success('Клиент добавлен');Modal.closeAll()">Сохранить</button>`
    });
  },
  viewDebts(id) { Toast.info(`Долги клиента ${id}`); }
};

// Purchases page
window.Pages.purchases = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Закупки</h1><p class="page-subtitle">Управление приходными накладными</p></div>
        <button class="btn btn-primary" onclick="window.Pages.purchases.create()">+ Новая закупка</button>
      </div>
      <div class="card">
        <div id="purch-list"><p class="color-muted p-4">Подключите сервер для загрузки данных</p></div>
      </div>
    </div>`;
  },
  init() {},
  create() { Toast.info('Создание закупки — в разработке'); }
};

// Reports page
window.Pages.reports = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Отчёты</h1><p class="page-subtitle">Аналитика и выгрузки</p></div>
      </div>
      <div class="grid-3 mb-6">
        ${[
          { icon:'📈', title:'Продажи', desc:'Выручка по периодам, товарам, кассирам', action:'rep_sales' },
          { icon:'📦', title:'Остатки', desc:'ОСВ по складу, движение товаров', action:'rep_stocks' },
          { icon:'💸', title:'Долги', desc:'Дебиторская задолженность', action:'rep_debts' },
          { icon:'🛒', title:'Закупки', desc:'Приходные накладные', action:'rep_purch' },
          { icon:'🔄', title:'Возвраты', desc:'Возвраты от покупателей', action:'rep_returns' },
          { icon:'📊', title:'Прибыль', desc:'Валовая прибыль и маржа', action:'rep_profit' },
        ].map(r=>`
          <div class="stat-card" style="cursor:pointer" onclick="window.Pages.reports.open('${r.action}')">
            <div class="stat-icon" style="background:var(--bg-hover);font-size:22px">${r.icon}</div>
            <div class="card-title mt-4">${r.title}</div>
            <div class="text-sm color-muted mt-2">${r.desc}</div>
          </div>`).join('')}
      </div>
      <div id="report-content"></div>
    </div>`;
  },
  open(type) {
    document.getElementById('report-content').innerHTML = `
      <div class="card fade-in">
        <div class="card-header">
          <div class="card-title">Параметры отчёта</div>
        </div>
        <div class="flex-row gap-3 mb-4">
          <div class="input-group" style="flex:1"><label>С</label><input type="date" id="rep-from" value="${new Date(Date.now()-30*86400000).toISOString().slice(0,10)}"/></div>
          <div class="input-group" style="flex:1"><label>По</label><input type="date" id="rep-to" value="${new Date().toISOString().slice(0,10)}"/></div>
          <div style="align-self:flex-end;padding-bottom:16px">
            <button class="btn btn-primary" onclick="Toast.info('Отчёт формируется...')">Сформировать</button>
            <button class="btn btn-ghost" onclick="Toast.info('Экспорт в Excel')">Excel</button>
          </div>
        </div>
        <p class="color-muted text-sm">Подключите сервер для получения данных отчёта</p>
      </div>`;
  },
  init() {}
};

// Warehouse page
window.Pages.warehouse = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Складские остатки</h1></div>
        <div class="flex-row gap-2">
          <button class="btn btn-ghost btn-sm" onclick="Toast.info('Экспорт Excel')">Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('audit')">Инвентаризация</button>
        </div>
      </div>
      <div class="card">
        <div class="filters-bar">
          <input class="filter-input" placeholder="Поиск товара..." style="flex:1"/>
          <select class="filter-input"><option>Все склады</option></select>
          <label class="flex-row gap-2 text-sm"><input type="checkbox"/> Только с остатком</label>
        </div>
        <p class="color-muted p-4">Подключите сервер для загрузки остатков</p>
      </div>
    </div>`;
  },
  init() {}
};

// Audit page
window.Pages.audit = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Инвентаризация</h1><p class="page-subtitle">Пересчёт товарных остатков</p></div>
        <button class="btn btn-primary" onclick="window.Pages.audit.startNew()">+ Начать инвентаризацию</button>
      </div>
      <div class="card mb-4">
        <div class="card-title mb-4">Активные инвентаризации</div>
        <p class="color-muted">Нет активных инвентаризаций</p>
      </div>
      <div class="card">
        <div class="card-title mb-4">История</div>
        ${buildTable([
          {key:'date',label:'Дата'},{key:'goods',label:'Позиций'},{key:'diff',label:'Расхождение'},
          {key:'status',label:'Статус',render:r=>`<span class="badge badge-success">${r.status}</span>`}
        ],[
          {date:'10.05.2025',goods:142,diff:'-3 / +1',status:'Завершена'},
          {date:'01.04.2025',goods:98,diff:'0',status:'Завершена'},
        ])}
      </div>
    </div>`;
  },
  startNew() { Toast.info('Выбор товаров для инвентаризации — в разработке'); },
  init() {}
};




// Kaspi page
window.Pages.kaspi = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">🛒 Kaspi Магазин</h1><p class="page-subtitle">Интеграция с Kaspi.kz marketplace</p></div>
        <a href="https://kaspi.kz/shop/merchant" target="_blank" class="btn btn-ghost btn-sm">Личный кабинет →</a>
      </div>
      <div class="card mb-6" style="background:linear-gradient(135deg,rgba(204,0,0,0.1),rgba(255,51,0,0.05));border-color:rgba(204,0,0,0.2)">
        <div class="flex-row gap-3">
          <span style="font-size:32px">🔴</span>
          <div>
            <div class="card-title">Kaspi Магазин API</div>
            <p class="text-sm color-muted">Управляйте товарами, заказами и остатками прямо из QDET. Требуется API-ключ от Kaspi Partners.</p>
          </div>
          <button class="btn btn-primary ml-auto" onclick="window.Pages.kaspi.connect()">Подключить</button>
        </div>
      </div>
      <div class="grid-3 mb-6">
        <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Активных товаров</div></div>
        <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Заказов сегодня</div></div>
        <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Выручка (₸)</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title mb-3">Возможности интеграции</div>
          <ul class="flex-col gap-2 text-sm">
            ${['Синхронизация остатков товаров','Получение и обработка заказов','Обновление статусов доставки','Управление ценами','Аналитика продаж'].map(f=>`<li class="flex-row gap-2"><span class="color-green">✓</span>${f}</li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <div class="card-title mb-3">Как подключить</div>
          <ol class="flex-col gap-2 text-sm color-muted" style="padding-left:16px">
            <li>Зарегистрируйтесь как продавец на Kaspi.kz</li>
            <li>Получите API-ключ в разделе Интеграции</li>
            <li>Введите ключ в настройках QDET</li>
            <li>Настройте маппинг товаров</li>
          </ol>
          <button class="btn btn-ghost btn-sm mt-4" onclick="window.Pages.kaspi.connect()">Настроить API →</button>
        </div>
      </div>
    </div>`;
  },
  connect() {
    Modal.open({ title: 'Подключить Kaspi API', body: `
      <div class="flex-col gap-3">
        <p class="text-sm color-muted">Введите API-ключ из личного кабинета Kaspi Partners (kaspi.kz/shop)</p>
        <div class="input-group"><label>API Token</label><input type="password" id="kaspi-token" placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."/></div>
        <div class="input-group"><label>Merchant ID</label><input type="text" id="kaspi-mid" placeholder="12345"/></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button><button class="btn btn-primary" onclick="Toast.success('Kaspi API подключён!');Modal.closeAll()">Сохранить</button>`
    });
  },
  init() {}
};

// WB page
window.Pages.wb = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">💜 Wildberries</h1><p class="page-subtitle">Интеграция с Wildberries KZ — скоро</p></div>
      </div>
      <div class="card" style="text-align:center;padding:60px 40px">
        <div style="font-size:64px;margin-bottom:16px">🚧</div>
        <h2 style="margin-bottom:8px">Скоро!</h2>
        <p class="color-muted" style="max-width:400px;margin:0 auto">Интеграция с Wildberries находится в разработке. Оставьте заявку, чтобы получить доступ первым.</p>
        <button class="btn btn-primary mt-4" onclick="Toast.success('Заявка отправлена!')">Оставить заявку</button>
      </div>
    </div>`;
  },
  init() {}
};

// Settings page
window.Pages.settings = {
  render() {
    return `<div class="fade-in">
      <div class="page-header"><h1 class="page-title">Настройки</h1></div>
      <div class="grid-2 gap-3">
        <div class="card">
          <div class="card-title mb-4">Основные</div>
          <div class="flex-col gap-3">
            <div class="input-group"><label>Название магазина</label><input type="text" placeholder="Мой магазин"/></div>
            <div class="input-group"><label>БИН/ИИН</label><input type="text" placeholder="123456789012"/></div>
            <div class="input-group"><label>Адрес</label><input type="text" placeholder="г. Алматы..."/></div>
            <button class="btn btn-primary btn-sm" onclick="Toast.success('Сохранено')">Сохранить</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-4">Подключения</div>
          <div class="flex-col gap-2">
            ${[
              { name:'НКТ API', status:'connected' },
              { name:'ЭСФ (КГД)', status:'disconnected' },
              { name:'Kaspi API', status:'disconnected' },
              { name:'Webkassa', status:'disconnected' },
              { name:'Firebase Push', status:'connected' },
            ].map(s=>`
              <div class="flex-row p-4" style="background:var(--bg-hover);border-radius:8px;gap:12px">
                <span class="text-sm font-bold" style="flex:1">${s.name}</span>
                <span class="badge ${s.status==='connected'?'badge-success':'badge-danger'}">${s.status==='connected'?'Подключено':'Не подключено'}</span>
                <button class="btn btn-ghost btn-sm">${s.status==='connected'?'Изменить':'Подключить'}</button>
              </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-4">ЭЦП</div>
          <p class="text-sm color-muted mb-4">Электронная цифровая подпись для подписания ЭСФ, СНТ и налоговых деклараций</p>
          <button class="btn btn-primary btn-sm" onclick="window.Pages.sono.uploadEcp()">Загрузить ЭЦП</button>
        </div>
        <div class="card">
          <div class="card-title mb-4">Сервер API</div>
          <div class="input-group"><label>URL сервера</label><input type="text" id="api-url" value="${window.urlServer || ''}" placeholder="VITE_URL_SERVER"/></div>
          <button class="btn btn-primary btn-sm mt-4" onclick="Toast.success('URL обновлён')">Сохранить</button>
        </div>
      </div>
    </div>`;
  },
  init() {}
};
