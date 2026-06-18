function buildTable(cols, rows, opts = {}) {
  const { emptyText = 'Нет данных', actionsFn } = opts;
  if (!rows || rows.length === 0) {
    return `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><h3>Нет данных</h3><p>${emptyText}</p></div>`;
  }
  const thead = `<thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}${actionsFn?'<th></th>':''}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c.render ? c.render(r) : (r[c.key]??'—')}</td>`).join('')}${actionsFn?`<td class="td-actions">${actionsFn(r)}</td>`:''}</tr>`).join('')}</tbody>`;
  return `<div class="table-wrapper"><table>${thead}${tbody}</table></div>`;
}
window.buildTable = buildTable;

function fmt(n, cur='₸') { return (+(n||0)).toLocaleString('ru-RU') + ' ' + cur; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('ru-RU') : '—'; }
window.fmt = fmt; window.fmtDate = fmtDate; window.fmtDateTime = fmtDateTime;
