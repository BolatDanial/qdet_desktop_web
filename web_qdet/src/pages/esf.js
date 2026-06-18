window.Pages.esf = {
  _docs: [],
  render() {
    return `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">📄 ЭСФ — Электронные счета-фактуры</h1>
          <p class="page-subtitle">Выставление и приём ЭСФ через ИС КГД (esf.gov.kz)</p>
        </div>
        <button class="btn btn-primary" onclick="window.Pages.esf.createNew()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Выставить ЭСФ
        </button>
      </div>

      <div class="stats-grid mb-6">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(108,99,255,0.15)">📤</div>
          <div class="stat-value" id="esf-cnt-out">—</div>
          <div class="stat-label">Исходящих</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,217,138,0.15)">📥</div>
          <div class="stat-value" id="esf-cnt-in">—</div>
          <div class="stat-label">Входящих</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(255,154,60,0.15)">⏳</div>
          <div class="stat-value" id="esf-cnt-pending">—</div>
          <div class="stat-label">Ожидают подтверждения</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(255,79,106,0.15)">❌</div>
          <div class="stat-value" id="esf-cnt-cancelled">—</div>
          <div class="stat-label">Аннулировано</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Реестр ЭСФ</div>
          <div class="flex-row gap-2">
            <select class="filter-input" id="esf-filter-type" onchange="window.Pages.esf.applyFilter()">
              <option value="">Все типы</option>
              <option value="out">Исходящие</option>
              <option value="in">Входящие</option>
            </select>
            <select class="filter-input" id="esf-filter-status" onchange="window.Pages.esf.applyFilter()">
              <option value="">Все статусы</option>
              <option value="new">Новый</option>
              <option value="sent">Отправлен</option>
              <option value="confirmed">Подтверждён</option>
              <option value="cancelled">Аннулирован</option>
            </select>
            <input class="filter-input" type="date" id="esf-date-from" onchange="window.Pages.esf.applyFilter()" />
            <input class="filter-input" type="date" id="esf-date-to" onchange="window.Pages.esf.applyFilter()" />
          </div>
        </div>
        <div id="esf-list"><div class="spinner-ring" style="margin:30px auto"></div></div>
      </div>
    </div>`;
  },

  async init() {
    console.log('ESF init called');
    try {
      if (window._esfPrefill) {
        console.log('Init ESF with prefill data:', window._esfPrefill);
        const data = window._esfPrefill;
        window._esfPrefill = null;
        this.createNew(data);
      }
    } catch (e) {
      console.error('Critical error in ESF prefill:', e);
    }
    await this.loadDocs();
  },

  async loadDocs() {
    try {
      const type = document.getElementById('esf-filter-type')?.value;
      const status = document.getElementById('esf-filter-status')?.value;
      const from = document.getElementById('esf-date-from')?.value;
      const to = document.getElementById('esf-date-to')?.value;

      const data = await API.esf.getList({ type, status, date_from: from, date_to: to });
      this._docs = data || [];
      
      document.getElementById('esf-cnt-out').textContent = this._docs.filter(d=>d.type==='out').length;
      document.getElementById('esf-cnt-in').textContent = this._docs.filter(d=>d.type==='in').length;
      document.getElementById('esf-cnt-pending').textContent = this._docs.filter(d=>d.status==='new'||d.status==='sent').length;
      document.getElementById('esf-cnt-cancelled').textContent = this._docs.filter(d=>d.status==='cancelled').length;
      this.applyFilter();
    } catch (err) {
      console.error('Failed to load ESF:', err);
      Toast.error('Ошибка загрузки списка ЭСФ');
      document.getElementById('esf-list').innerHTML = '<div class="text-center p-4 color-red">Не удалось загрузить данные</div>';
    }
  },

  applyFilter() {
    let docs = [...this._docs];
    const type = document.getElementById('esf-filter-type')?.value;
    const status = document.getElementById('esf-filter-status')?.value;
    if (type) docs = docs.filter(d => d.type === type);
    if (status) docs = docs.filter(d => d.status === status);
    this.renderList(docs);
  },

  statusLabel(s) {
    const m = { new:'Новый', sent:'Отправлен', confirmed:'Подтверждён', cancelled:'Аннулирован' };
    const cls = { new:'badge-info', sent:'badge-warning', confirmed:'badge-success', cancelled:'badge-danger' };
    return `<span class="badge ${cls[s]||'badge-muted'}">${m[s]||s}</span>`;
  },

  typeLabel(t) { return t==='out' ? '<span class="badge badge-info">📤 Исходящий</span>' : '<span class="badge badge-muted">📥 Входящий</span>'; },

  renderList(docs) {
    document.getElementById('esf-list').innerHTML = buildTable([
      { key: 'num', label: '№ ЭСФ' },
      { key: 'date', label: 'Дата' },
      { key: 'type', label: 'Тип', render: r => this.typeLabel(r.type) },
      { key: 'counterparty', label: 'Контрагент', render: r => `<div><div class="font-bold">${r.counterparty}</div><div class="text-xs color-muted">БИН: ${r.bin}</div></div>` },
      { key: 'total', label: 'Сумма (₸)', render: r => `<div class="font-bold">${fmt(r.total)}</div><div class="text-xs color-muted">НДС: ${fmt(r.vat)}</div>` },
      { key: 'status', label: 'Статус', render: r => this.statusLabel(r.status) },
    ], docs, {
      actionsFn: r => `
        <button class="btn btn-ghost btn-sm" onclick="window.Pages.esf.viewDoc('${r.num}')">Открыть</button>
        ${r.type==='in' && r.status==='new' ? `<button class="btn btn-success btn-sm" onclick="window.Pages.esf.confirm('${r.num}')">Подтвердить</button>` : ''}
        ${r.status !== 'cancelled' ? `<button class="btn btn-ghost btn-sm color-red" onclick="window.Pages.esf.cancel('${r.num}')">Аннулировать</button>` : ''}
      `
    });
  },

  createNew(prefill = null) {
    console.log('createNew called with prefill:', !!prefill);
    const mid = 'modal-esf-' + Date.now();
    const docNum = prefill?.doc_id || '---';
    const dateTurnover = prefill?.date ? prefill.date.slice(0,10) : new Date().toISOString().slice(0,10);
    
    try {
      Modal.open({
        id: mid,
        title: 'Выставить новый ЭСФ (Полная форма)',
        size: '1100px',
        body: `
          <div class="esf-form-container full-form">
            <div class="esf-scroll-content">
              <!-- Раздел А -->
              <div class="section-group mb-4">
                <h4 class="section-title">Раздел А: Общий раздел</h4>
                <div class="grid-3 gap-4">
                  <div class="input-group"><label>Регистрационный номер</label><input type="text" id="esf-reg-num" value="" placeholder="Заполняется ИС ЭСФ" disabled /></div>
                  <div class="input-group"><label>Номер счета-фактуры</label><input type="text" id="esf-num-inner" value="${prefill ? 'ЭСФ-' + docNum : ''}" placeholder="001" /></div>
                  <div class="input-group"><label>Дата выписки</label><input type="date" id="esf-date-out" value="${new Date().toISOString().slice(0,10)}" /></div>
                </div>
                <div class="grid-3 gap-4 mt-2">
                  <div class="input-group"><label>Дата совершения оборота</label><input type="date" id="esf-date-turnover" value="${dateTurnover}" /></div>
                  <div class="input-group">
                    <label>Вид счета-фактуры</label>
                    <select id="esf-type">
                      <option value="REGULAR" selected>Обычный</option>
                      <option value="CORRECTIVE">Исправленный</option>
                      <option value="ADDITIONAL">Дополнительный</option>
                    </select>
                  </div>
                  <div class="input-group"><label>Валюта</label><input type="text" value="KZT (Тенге)" disabled /></div>
                </div>
              </div>

              <div class="grid-2 gap-4">
                <!-- Раздел B -->
                <div class="section-group">
                  <h4 class="section-title">Раздел B: Реквизиты поставщика</h4>
                  <div class="input-group"><label>БИН/ИИН</label><input type="text" value="123456789012" disabled /></div>
                  <div class="input-group"><label>Наименование</label><input type="text" value="ТОО 'QDET'" disabled /></div>
                  <div class="input-group"><label>Адрес</label><input type="text" value="г. Алматы, мкр. Аксай-4, 12" disabled /></div>
                  <div class="input-group">
                    <label>Статус поставщика</label>
                    <select id="esf-supplier-status">
                      <option value="SELLER" selected>Поставщик</option>
                      <option value="COMMITENT">Комитент</option>
                      <option value="FORWARDER">Экспедитор</option>
                    </select>
                  </div>
                </div>

                <!-- Раздел C -->
                <div class="section-group">
                  <h4 class="section-title">Раздел C: Реквизиты получателя</h4>
                  <div class="input-group"><label>БИН/ИИН получателя *</label><input type="text" id="esf-recipient-bin" maxlength="12" value="${prefill?.client_bin || ''}" oninput="window.Pages.esf.lookupRecipient(this.value)" /></div>
                  <div class="input-group"><label>Наименование получателя *</label><input type="text" id="esf-recipient-name" value="${prefill?.client_name || ''}" /></div>
                  <div class="input-group"><label>Адрес места нахождения</label><input type="text" id="esf-recipient-address" value="${prefill?.client_address || ''}" /></div>
                  <div class="grid-2 gap-2">
                    <div class="input-group"><label>БИК банка</label><input type="text" id="esf-recipient-bik" value="${prefill?.client_bik || ''}" /></div>
                    <div class="input-group"><label>ИИК (Счет)</label><input type="text" id="esf-recipient-iik" value="${prefill?.client_iik || ''}" /></div>
                  </div>
                  <div class="input-group">
                    <label>Категория получателя</label>
                    <select id="esf-recipient-cat">
                      <option value="OTHER" selected>Прочее</option>
                      <option value="RETAIL">Розничный реализатор</option>
                      <option value="GR">Государственное учреждение</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Разделы E, F -->
              <div class="section-group mt-4">
                <h4 class="section-title">Раздел E, F: Договор и документы поставки</h4>
                <div class="grid-3 gap-4">
                  <div class="input-group"><label>№ Договора (контракта)</label><input type="text" id="esf-contract-num" value="${prefill?.contract_num || 'Б/Н'}" placeholder="Б/Н" /></div>
                  <div class="input-group"><label>Дата договора</label><input type="date" id="esf-contract-date" value="${prefill?.contract_date || ''}" /></div>
                  <div class="input-group"><label>Условия оплаты</label><input type="text" id="esf-payment-terms" placeholder="По факту" /></div>
                </div>
                <div class="grid-3 gap-4 mt-2">
                  <div class="input-group"><label>Способ отправки</label><input type="text" id="esf-shipment-method" placeholder="Самовывоз/Доставка" /></div>
                  <div class="input-group"><label>Документ поставки (Накладная)</label><input type="text" id="esf-doc-delivery" value="${prefill ? 'Накладная №' + docNum : ''}" placeholder="№ и дата накладной" /></div>
                  <div class="input-group"><label>Пункт назначения</label><input type="text" id="esf-destination" placeholder="Адрес доставки" /></div>
                </div>
              </div>

              <!-- Раздел G -->
              <div class="section-group mt-4">
                <div class="flex-row items-center mb-4">
                  <h4 class="section-title" style="margin-bottom:0">Раздел G: Товары и услуги</h4>
                  <button class="btn btn-ghost btn-sm ml-auto" onclick="window.Pages.esf.addItemRow()">+ Добавить строку</button>
                </div>
                <div class="esf-table-wrapper">
                  <table class="esf-items-table">
                    <thead>
                      <tr>
                        <th width="40">№</th><th width="60">Пр.</th><th>Наименование</th><th width="100">ТН ВЭД</th><th width="150">ГТД / 328.00</th><th width="80">Кол-во</th><th width="100">Цена</th><th width="80">Ставка</th><th width="100">НДС</th><th width="120">Всего</th><th width="40"></th>
                      </tr>
                    </thead>
                    <tbody id="esf-items-body"></tbody>
                  </table>
                </div>
                
                <div class="esf-total-bar mt-4">
                  <div class="flex-col">
                    <span class="text-xs color-muted">ИТОГО БЕЗ НДС:</span>
                    <span id="esf-total-nosum" class="font-bold">0 ₸</span>
                  </div>
                  <div class="flex-col ml-8">
                    <span class="text-xs color-muted">ИТОГО НДС:</span>
                    <span id="esf-total-vatsum" class="font-bold">0 ₸</span>
                  </div>
                  <div class="flex-col ml-auto text-right">
                    <span class="text-xs color-muted">ВСЕГО К ОПЛАТЕ:</span>
                    <span id="esf-total-full" class="font-bold text-xl color-accent">0 ₸</span>
                  </div>
                </div>
              </div>

              <!-- Разделы K, L -->
              <div class="section-group mt-4">
                <h4 class="section-title">Разделы K, L: Дополнительные сведения</h4>
                <div class="input-group"><label>Дополнительная информация</label>
                  <textarea id="esf-extra-info" class="filter-input" style="width:100%;height:60px" placeholder="Любые дополнительные сведения...">${prefill?.extra_info || ''}</textarea>
                </div>
              </div>
            </div>
          </div>`,
        footer: `
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Отмена</button>
          <button class="btn btn-primary" onclick="window.Pages.esf.submitNew('${mid}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            Подписать и отправить
          </button>`
      });
      console.log('Modal.open finished');
    } catch (err) {
      console.error('Modal.open crash:', err);
    }

    console.log('Opening ESF modal...');
    if (prefill && prefill.items) {
      setTimeout(() => {
        console.log('Prefilling items:', prefill.items.length);
        const tbody = document.getElementById('esf-items-body');
        if (tbody) tbody.innerHTML = ''; // Clear defaults
        prefill.items.forEach(item => this.addItemRow(item));
        if (prefill.client_bin) this.lookupRecipient(prefill.client_bin);
      }, 200);
    } else {
      setTimeout(() => this.addItemRow(), 200);
    }
  },

  // Removed switchFormTab as we now use full form

  addItemRow(data = null) {
    const tbody = document.getElementById('esf-items-body');
    if (!tbody) return;
    const idx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.className = 'esf-item-row';
    tr.innerHTML = `
      <td>${idx}</td>
      <td>
        <select class="table-input origin-code" style="width:45px;padding:2px">
          <option value="1">1</option><option value="2">2</option>
          <option value="3" ${data?.origin==='3'?'selected':''}>3</option><option value="4">4</option>
          <option value="5" ${!data || data.origin==='5'?'selected':''}>5</option><option value="6">6</option>
        </select>
      </td>
      <td><input type="text" class="table-input" value="${data?.name || ''}" placeholder="Товар/услуга" /></td>
      <td><input type="text" class="table-input" value="${data?.tnved || ''}" placeholder="Код" style="width:80px" /></td>
      <td><input type="text" class="table-input" value="${data?.gtd || ''}" placeholder="№ ДТ / 328.00" style="width:110px" /></td>
      <td><input type="number" class="table-input qty" value="${data?.qty || 1}" oninput="window.Pages.esf.calcRow(this)" style="width:50px" /></td>
      <td><input type="number" class="table-input price" value="${data?.price || 0}" oninput="window.Pages.esf.calcRow(this)" style="width:90px" /></td>
      <td>
        <select class="table-input vat-rate" onchange="window.Pages.esf.calcRow(this)" style="width:70px">
          <option value="12">12%</option>
          <option value="0">0%</option>
          <option value="-1">Без НДС</option>
        </select>
      </td>
      <td class="row-vat" style="white-space:nowrap">0</td>
      <td class="row-total" style="white-space:nowrap">0</td>
      <td><button class="btn-icon color-red" onclick="this.closest('tr').remove(); window.Pages.esf.updateTotals()">×</button></td>
    `;
    tbody.appendChild(tr);
    this.calcRow(tr.querySelector('.qty')); // Initial calc
  },

  calcRow(input) {
    const tr = input.closest('tr');
    const qty = parseFloat(tr.querySelector('.qty').value) || 0;
    const price = parseFloat(tr.querySelector('.price').value) || 0;
    const rate = parseFloat(tr.querySelector('.vat-rate').value);
    
    const sumNoVat = qty * price;
    let vat = 0;
    if (rate >= 0) vat = sumNoVat * rate / 100;
    
    tr.querySelector('.row-vat').textContent = fmt(vat);
    tr.querySelector('.row-total').textContent = fmt(sumNoVat + vat);
    
    tr.dataset.sumNoVat = sumNoVat;
    tr.dataset.vat = vat;
    
    this.updateTotals();
  },

  updateTotals() {
    let totalNoVat = 0;
    let totalVat = 0;
    document.querySelectorAll('.esf-item-row').forEach(tr => {
      totalNoVat += parseFloat(tr.dataset.sumNoVat) || 0;
      totalVat += parseFloat(tr.dataset.vat) || 0;
    });
    
    document.getElementById('esf-total-nosum').textContent = fmt(totalNoVat);
    document.getElementById('esf-total-vatsum').textContent = fmt(totalVat);
    document.getElementById('esf-total-full').textContent = fmt(totalNoVat + totalVat);
  },

  lookupRecipient(bin) {
    if (bin.length === 12) {
      // Mock lookup for demo
      const directory = {
        '121212121212': { name: 'ТОО "ТехноСклад"', addr: 'г. Алматы, пр. Абая, 10', bik: 'KAZKKZKX', iik: 'KZ123456789012345678' },
        '880101345678': { name: 'ИП Петров Иван', addr: 'г. Астана, ул. Достык, 5', bik: 'HSBKKZKX', iik: 'KZ987654321098765432' },
        '000000000000': { name: 'Розничный покупатель', addr: 'Физическое лицо', bik: '', iik: '' }
      };
      
      const client = directory[bin];
      if (client) {
        document.getElementById('esf-recipient-name').value = client.name;
        document.getElementById('esf-recipient-address').value = client.addr;
        document.getElementById('esf-recipient-bik').value = client.bik;
        document.getElementById('esf-recipient-iik').value = client.iik;
        
        if (bin === '000000000000') {
          document.getElementById('esf-recipient-cat').value = 'RETAIL';
        } else {
          document.getElementById('esf-recipient-cat').value = 'OTHER';
        }
      }
    }
  },

  async submitNew(modalId) {
    const btn = document.querySelector(`#${modalId} .btn-primary`);
    const originalText = btn.innerHTML;
    
    try {
      const data = {
        num_inner: document.getElementById('esf-num-inner').value,
        date_out: document.getElementById('esf-date-out').value,
        date_turnover: document.getElementById('esf-date-turnover').value,
        
        recipient_bin: document.getElementById('esf-recipient-bin').value,
        recipient_name: document.getElementById('esf-recipient-name').value,
        recipient_address: document.getElementById('esf-recipient-address').value,
        recipient_cat: document.getElementById('esf-recipient-cat').value,
        
        contract_num: document.getElementById('esf-contract-num').value,
        contract_date: document.getElementById('esf-contract-date').value,
        payment_terms: document.getElementById('esf-payment-terms').value,
        shipment_method: document.getElementById('esf-shipment-method').value,
        destination: document.getElementById('esf-destination').value,
        extra_info: document.getElementById('esf-extra-info').value,
        
        sum: parseFloat(document.getElementById('esf-total-full').textContent.replace(/[^0-9.]/g, '')),
      };

      if (!data.recipient_bin || !data.recipient_name) {
        Toast.error('Заполните обязательные поля получателя');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<div class="spinner-ring sm"></div> Подписание...';

      // Simulation of signing delay
      await new Promise(r => setTimeout(r, 1500));

      await API.esf.send({
        buyer_bin: data.recipient_bin,
        buyer_name: data.recipient_name,
        sum: data.sum,
        vat_rate: 12 // Default for stub
      });
      
      Toast.success('ЭСФ успешно подписан и отправлен');
      Modal.close(modalId);
      this.loadDocs();
    } catch (err) {
      console.error('ESF send error:', err);
      Toast.error(err.message || 'Ошибка при отправке ЭСФ');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async viewDoc(num) {
    try {
      const doc = await API.esf.getDetails(num);
      
      Modal.open({
        title: `Просмотр ЭСФ № ${doc.num}`,
        size: '800px',
        body: `
          <div class="esf-view">
            <div class="section-group mb-4">
              <h4 class="section-title">Раздел А: Основные данные</h4>
              <div class="grid-2">
                <div><span class="color-muted">Дата выписки:</span> ${fmtDate(doc.date)}</div>
                <div><span class="color-muted">Статус:</span> ${this.statusLabel(doc.status)}</div>
                <div><span class="color-muted">Тип:</span> ${this.typeLabel(doc.type)}</div>
              </div>
            </div>

            <div class="grid-2 gap-4">
              <div class="section-group">
                <h4 class="section-title">Раздел B: Поставщик</h4>
                <div class="font-bold">ТОО "QDET"</div>
                <div class="text-xs color-muted">БИН: 123456789012</div>
              </div>
              <div class="section-group">
                <h4 class="section-title">Раздел C: Получатель</h4>
                <div class="font-bold">${doc.counterparty}</div>
                <div class="text-xs color-muted">БИН: ${doc.bin}</div>
              </div>
            </div>

            <div class="section-group mt-4">
              <h4 class="section-title">Итоговые суммы</h4>
              <div class="esf-total-bar">
                <div class="flex-col">
                  <span class="text-xs color-muted">НДС:</span>
                  <span class="font-bold">${fmt(doc.vat)}</span>
                </div>
                <div class="flex-col ml-auto text-right">
                  <span class="text-xs color-muted">ВСЕГО К ОПЛАТЕ:</span>
                  <span class="font-bold text-xl color-accent">${fmt(doc.total)}</span>
                </div>
              </div>
            </div>
            
            <p class="text-xs color-muted mt-4">* Полный список товаров (Раздел G) доступен в режиме редактирования или в печатной форме.</p>
          </div>`,
        footer: `
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button>
          <button class="btn btn-primary" onclick="Toast.info('Печатная форма генерируется...')">Скачать PDF</button>`
      });
    } catch (err) {
      console.error('View doc error:', err);
      Toast.error('Не удалось загрузить данные документа');
    }
  },
  confirm(num) { Toast.success(`ЭСФ ${num} подтверждён`); },
  cancel(num) {
    if (confirm(`Аннулировать ЭСФ ${num}?`)) Toast.success(`ЭСФ ${num} аннулирован`);
  }
};
