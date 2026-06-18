// SNT page
window.Pages.snt = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">🚛 СНТ — Сопроводительные накладные</h1>
        <p class="page-subtitle">Создание и подтверждение СНТ через ИС ЭСФ</p></div>
        <button class="btn btn-primary" onclick="window.Pages.snt.createNew()">+ Создать СНТ</button>
      </div>
      <div class="stats-grid mb-6">
        <div class="stat-card"><div class="stat-icon" style="background:rgba(108,99,255,0.15)">📤</div><div class="stat-value">12</div><div class="stat-label">Исходящих</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(16,217,138,0.15)">📥</div><div class="stat-value">8</div><div class="stat-label">Входящих</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(255,154,60,0.15)">⏳</div><div class="stat-value">3</div><div class="stat-label">В ожидании</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Реестр СНТ</div>
          <select class="filter-input" id="snt-filter" onchange="window.Pages.snt.filter()">
            <option value="">Все</option><option value="out">Исходящие</option><option value="in">Входящие</option>
          </select>
        </div>
        <div id="snt-list"></div>
      </div>
    </div>`;
  },
  init() {
    const docs = [
      { num: 'СНТ-2025-001', date: '2025-05-10', from: 'ТОО "Поставщик"', to: 'Наш магазин', type: 'in', status: 'confirmed', goods: 15 },
      { num: 'СНТ-2025-002', date: '2025-05-11', from: 'Наш магазин', to: 'ТОО "Клиент"', type: 'out', status: 'sent', goods: 8 },
      { num: 'СНТ-2025-003', date: '2025-05-09', from: 'ТОО "Другой"', to: 'Наш магазин', type: 'in', status: 'new', goods: 22 },
    ];
    const st = { new:'<span class="badge badge-warning">Новый</span>', sent:'<span class="badge badge-info">Отправлен</span>', confirmed:'<span class="badge badge-success">Подтверждён</span>' };
    document.getElementById('snt-list').innerHTML = buildTable([
      {key:'num',label:'№ СНТ'},{key:'date',label:'Дата'},
      {key:'from',label:'Отправитель'},{key:'to',label:'Получатель'},
      {key:'goods',label:'Позиций'},{key:'status',label:'Статус',render:r=>st[r.status]||r.status},
    ], docs, { actionsFn: r => `
      <button class="btn btn-ghost btn-sm" onclick="Toast.info('Просмотр СНТ')">Открыть</button>
      ${r.type==='in'&&r.status==='new'?`<button class="btn btn-success btn-sm" onclick="Toast.success('СНТ подтверждён')">Подтвердить</button>`:''}
      ${r.status!=='confirmed'?`<button class="btn btn-ghost btn-sm" onclick="Toast.error('СНТ отклонён')">Отклонить</button>`:''}
    `});
  },
  filter() { this.init(); },
  createNew() {
    Modal.open({ title: 'Создать СНТ', body: `
      <div class="flex-col gap-3">
        <div class="input-group"><label>БИН получателя</label><input type="text" placeholder="123456789012" /></div>
        <div class="input-group"><label>Наименование получателя</label><input type="text" placeholder="ТОО «Название»" /></div>
        <div class="input-group"><label>Дата отгрузки</label><input type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
        <div class="input-group"><label>Номер накладной</label><input type="text" placeholder="НК-001" /></div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button><button class="btn btn-primary" onclick="Toast.success('СНТ создан');Modal.closeAll()">Создать</button>`
    });
  }
};
