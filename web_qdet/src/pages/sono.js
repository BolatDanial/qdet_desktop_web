// SONO — Tax reporting page
window.Pages.sono = {
  render() {
    return `<div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">📊 СОНО — Налоговая отчётность</h1>
        <p class="page-subtitle">Формирование и отправка деклараций в КГД РК (cabinet.salyk.kz)</p></div>
        <a href="https://cabinet.salyk.kz" target="_blank" class="btn btn-ghost btn-sm">Открыть кабинет КГД →</a>
      </div>

      <div class="card mb-6" style="border-color:rgba(255,154,60,0.3);background:rgba(255,154,60,0.05)">
        <div class="flex-row gap-3">
          <span style="font-size:24px">⚠️</span>
          <div>
            <div class="font-bold">Требуется ЭЦП для отправки</div>
            <p class="text-sm color-muted">Для отправки деклараций необходимо загрузить сертификат ЭЦП (файл .p12). Формирование и просмотр доступны без ЭЦП.</p>
          </div>
          <button class="btn btn-primary btn-sm ml-auto" onclick="window.Pages.sono.uploadEcp()">Загрузить ЭЦП</button>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-title mb-4">Предстоящие сроки</div>
          <div class="flex-col gap-3">
            ${[
              { form:'910.00', name:'Упрощённая декларация', deadline:'2025-06-15', period:'I пол. 2025', urgent:true },
              { form:'300.00', name:'Декларация по НДС', deadline:'2025-06-15', period:'Май 2025', urgent:true },
              { form:'200.00', name:'ИПН и СО', deadline:'2025-06-15', period:'Май 2025', urgent:false },
              { form:'100.00', name:'КПН', deadline:'2026-03-31', period:'2025 год', urgent:false },
            ].map(f=>`
              <div class="flex-row" style="padding:10px;background:var(--bg-hover);border-radius:8px;gap:12px">
                <div class="badge ${f.urgent?'badge-danger':'badge-info'}" style="min-width:60px;justify-content:center">${f.form}</div>
                <div style="flex:1">
                  <div class="font-bold text-sm">${f.name}</div>
                  <div class="text-xs color-muted">${f.period} · до ${f.deadline}</div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="window.Pages.sono.openForm('${f.form}')">Сформировать</button>
              </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-4">История отправок</div>
          ${buildTable([
            {key:'form',label:'Форма'},{key:'period',label:'Период'},
            {key:'sent',label:'Отправлено'},{key:'status',label:'Статус',render:r=>`<span class="badge badge-success">${r.status}</span>`}
          ],[
            {form:'910.00',period:'II пол. 2024',sent:'15.01.2025',status:'Принята'},
            {form:'300.00',period:'Дек 2024',sent:'15.01.2025',status:'Принята'},
            {form:'200.00',period:'Дек 2024',sent:'15.01.2025',status:'Принята'},
          ])}
        </div>
      </div>

      <div id="sono-form-container"></div>
    </div>`;
  },

  openForm(code) {
    const forms = {
      '910.00': { name: 'Упрощённая декларация', fields: ['ИИН/БИН', 'Период', 'Доход', 'Налог (3%)'] },
      '300.00': { name: 'Декларация по НДС', fields: ['БИН плательщика НДС', 'Налоговый период', 'Оборот (облагаемый)', 'НДС начисленный (12%)', 'НДС к зачёту'] },
      '200.00': { name: 'ИПН и Социальные отчисления', fields: ['БИН работодателя', 'Период', 'Фонд оплаты труда', 'ИПН', 'СО', 'ОСМС', 'ОПВ'] },
      '100.00': { name: 'КПН (Корпоративный подоходный налог)', fields: ['БИН', 'Налоговый год', 'Совокупный годовой доход', 'Расходы', 'Налогооблагаемый доход', 'КПН (20%)'] },
    };
    const f = forms[code] || { name: code, fields: [] };
    document.getElementById('sono-form-container').innerHTML = `
      <div class="card fade-in">
        <div class="card-header">
          <div><div class="card-title">Форма ${code} — ${f.name}</div><div class="card-subtitle">Предварительное заполнение</div></div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sono-form-container').innerHTML=''">✕ Закрыть</button>
        </div>
        <div class="grid-2 mb-4">
          ${f.fields.map(field=>`<div class="input-group"><label>${field}</label><input type="text" placeholder="Введите значение" /></div>`).join('')}
        </div>
        <div class="flex-row gap-2">
          <button class="btn btn-primary" onclick="Toast.info('Сохранено как черновик')">Сохранить черновик</button>
          <button class="btn btn-ghost" onclick="Toast.info('Экспорт в PDF')">Экспорт PDF</button>
          <button class="btn btn-ghost ml-auto" onclick="Toast.info('Для отправки загрузите ЭЦП')">Отправить в КГД</button>
        </div>
      </div>`;
    document.getElementById('sono-form-container').scrollIntoView({ behavior:'smooth' });
  },

  uploadEcp() {
    Modal.open({ title: 'Загрузить ЭЦП', body: `
      <div class="flex-col gap-3">
        <p class="text-sm color-muted">Загрузите файл сертификата ЭЦП в формате .p12 (RSA или GOST)</p>
        <div class="input-group"><label>Файл сертификата (.p12)</label><input type="file" accept=".p12" /></div>
        <div class="input-group"><label>Пароль</label><input type="password" placeholder="••••••••" /></div>
        <div class="card" style="background:rgba(255,154,60,0.05);border-color:rgba(255,154,60,0.2)">
          <p class="text-sm">🔒 Ключ ЭЦП хранится только в памяти браузера и не передаётся на сервер в открытом виде</p>
        </div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button><button class="btn btn-primary" onclick="Toast.success('ЭЦП успешно загружена');Modal.closeAll()">Подключить</button>`
    });
  },

  init() {}
};
