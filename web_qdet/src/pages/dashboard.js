// Dashboard page
window.Pages.dashboard = {
  render() {
    return `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Дашборд</h1>
          <p class="page-subtitle">Обзор торговой деятельности</p>
        </div>
        <div class="flex-row gap-2">
          <select class="filter-input" id="dash-period" onchange="window.Pages.dashboard.loadData()">
            <option value="today">Сегодня</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
            <option value="all" selected>Всё время</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="window.Pages.dashboard.loadData()">Обновить</button>
        </div>
      </div>

      <div class="stats-grid" id="dash-stats">
        ${this.statSkel(4)}
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Выручка по дням</div>
              <div class="card-subtitle">Динамика продаж</div>
            </div>
          </div>
          <div class="chart-area" id="dash-chart"></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Последние продажи</div>
            <button class="btn btn-ghost btn-sm" onclick="navigate('sales')">Все →</button>
          </div>
          <div id="dash-recent-sales"><div class="spinner-ring" style="margin:20px auto"></div></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Топ товаров</div>
          </div>
          <div id="dash-top-goods"><div class="spinner-ring" style="margin:20px auto"></div></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Быстрые действия</div>
          </div>
          <div class="flex-col gap-2" style="padding-top:8px">
            <button class="btn btn-primary" onclick="navigate('sales')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              Новая продажа
            </button>
            <button class="btn btn-ghost" onclick="navigate('purchases')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
              Новая закупка
            </button>
            <button class="btn btn-ghost" onclick="navigate('nkt')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Найти товар в НКТ
            </button>
            <button class="btn btn-ghost" onclick="navigate('esf')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
              Выставить ЭСФ
            </button>
            <button class="btn btn-ghost" onclick="navigate('audit')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Начать инвентаризацию
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  statSkel(n) {
    return Array(n).fill(0).map(()=>`
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--bg-hover);width:44px;height:44px;border-radius:12px"></div>
        <div style="background:var(--bg-hover);height:28px;border-radius:6px;margin:12px 0 4px;width:70%"></div>
        <div style="background:var(--bg-hover);height:14px;border-radius:4px;width:50%"></div>
      </div>`).join('');
  },

  async loadData() {
    const period = document.getElementById('dash-period')?.value || 'month';
    // Show skeleton
    document.getElementById('dash-stats').innerHTML = this.statSkel(4);

    let d = null;
    try {
      d = await API.webDashboard.getData(period);
    } catch(e) {
      Toast.error(e.message || 'Не удалось загрузить дашборд');
    }

    if (d && d.kpi) {
      this._renderKpi(d.kpi);
      this._renderChart(d.chart || []);
      this._renderRecentSales(d.recent_sales || []);
      this._renderTopGoods(d.top_goods || []);
    } else {
      this._renderKpi({});
      this._renderChart([]);
      this._renderRecentSales([]);
      this._renderTopGoods([]);
    }
  },

  _renderKpi(kpi) {
    const net = (kpi.revenue || 0) - (kpi.returns || 0);
    const avg = kpi.sales_count ? net / kpi.sales_count : 0;
    const stats = [
      { icon:'💰', label:'Выручка',   value: fmt(net),             change: kpi.returns ? `↩ ${fmt(kpi.returns)}` : '', dir:'', color:'#6C63FF' },
      { icon:'🛒', label:'Продаж',    value: kpi.sales_count || 0,  change: kpi.returns_count ? `${kpi.returns_count} возвратов` : '', dir:'', color:'#10D98A' },
      { icon:'📦', label:'Товаров',   value: (kpi.goods_count||0).toLocaleString(), change:'', dir:'', color:'#3ECFCF' },
      { icon:'👥', label:'Клиентов',  value: kpi.clients_count || 0, change: kpi.new_clients ? `+${kpi.new_clients} новых` : '', dir:'up', color:'#FF9A3C' },
    ];
    document.getElementById('dash-stats').innerHTML = stats.map(s => `
      <div class="stat-card fade-in">
        <div class="stat-icon" style="background:${s.color}22">
          <span style="font-size:22px">${s.icon}</span>
        </div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
        ${s.change ? `<div class="stat-change ${s.dir}">${s.change}</div>` : ''}
      </div>`).join('');
  },

  _renderChart(chartData) {
    if (!chartData.length) {
      document.getElementById('dash-chart').innerHTML = '<p class="color-muted text-sm p-4">Нет данных</p>';
      return;
    }
    const vals = chartData.map(r => r.total);
    const max = Math.max(...vals) || 1;
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    document.getElementById('dash-chart').innerHTML = chartData.map(r => {
      const d = new Date(r.day);
      return `<div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${(r.total/max*180)}px" title="${fmt(r.total)}"></div>
        <span class="chart-label">${days[d.getDay()]}</span>
      </div>`;
    }).join('');
  },

  _renderRecentSales(sales) {
    const payBadge = r => {
      if (r.card > 0 && r.cash === 0 && r.debt === 0) return '<span class="badge badge-info">💳 Карта</span>';
      if (r.debt > 0) return '<span class="badge badge-warning">📋 В долг</span>';
      return '<span class="badge badge-success">💵 Нал</span>';
    };
    document.getElementById('dash-recent-sales').innerHTML = buildTable([
      { key:'doc_id',      label:'№' },
      { key:'client_name', label:'Клиент' },
      { key:'total',       label:'Сумма',  render: r => `<b>${fmt(r.total)}</b>` },
      { key:'pay',         label:'Оплата', render: r => payBadge(r) },
    ], sales);
  },

  _renderTopGoods(goods) {
    document.getElementById('dash-top-goods').innerHTML = buildTable([
      { key:'name',  label:'Товар' },
      { key:'qty',   label:'Кол-во', render: r => Math.round(r.qty) },
      { key:'total', label:'Выручка', render: r => fmt(r.total) },
    ], goods);
  },

  init() { this.loadData(); }
};
