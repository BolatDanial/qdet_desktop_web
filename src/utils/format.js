export function fmt(value, currency = '₸') {
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

export function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—';
}

export function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}

export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
