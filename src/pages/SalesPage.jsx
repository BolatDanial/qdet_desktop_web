import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { fmt, fmtDateTime } from '../utils/format.js';

const today = () => new Date().toISOString().slice(0, 10);

function PayBadge({ value }) {
  const { t } = useI18n();
  const map = { cash: ['badge-success', t('cashFull')], card: ['badge-info', t('card')], debt: ['badge-warning', t('debt')] };
  const [className, text] = map[value] || ['badge-muted', value || '—'];
  return <span className={`badge ${className}`}>{text}</span>;
}

export function SalesPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const [filters, setFilters] = useState({ from: today(), to: today(), type: '', pay: '', search: '' });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    api.sales
      .getReports({ date_from: filters.from, date_to: filters.to, doc_type: filters.type || undefined, pay_type: filters.pay || undefined })
      .then((data) => active && setRows(Array.isArray(data) ? data : data?.sales || data?.items || []))
      .catch((event) => {
        if (!active) return;
        setRows([]);
        setError(event.message || t('loadSalesError'));
      });
    return () => {
      active = false;
    };
  }, [filters.from, filters.pay, filters.to, filters.type, t]);

  const visible = useMemo(() => {
    const q = filters.search.toLowerCase();
    return q ? rows.filter((row) => `${row.client_name || ''} ${row.doc_id || ''}`.toLowerCase().includes(q)) : rows;
  }, [filters.search, rows]);

  const stats = useMemo(() => {
    const sales = rows.filter((row) => row.doc_type !== 'return');
    const returns = rows.filter((row) => row.doc_type === 'return');
    const revenue = sales.reduce((sum, row) => sum + (row.total || 0), 0);
    return { revenue, count: sales.length, avg: sales.length ? revenue / sales.length : 0, returns: returns.length };
  }, [rows]);

  const patchFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const view = (row) => modal.open({
    title: t('checkTitle', { id: row.doc_id }),
    body: (
      <div className="flex-col gap-3">
        <div className="grid-2">
          <div><p className="text-xs color-muted">{t('dateTime').toUpperCase()}</p><p className="font-bold">{fmtDateTime(row.time_create)}</p></div>
          <div><p className="text-xs color-muted">{t('client').toUpperCase()}</p><p className="font-bold">{row.client_name || t('retail')}</p></div>
          <div><p className="text-xs color-muted">{t('payment').toUpperCase()}</p><PayBadge value={row.pay_type} /></div>
          <div><p className="text-xs color-muted">{t('positions').toUpperCase()}</p><p className="font-bold">{row.items_count ?? '—'}</p></div>
        </div>
        <div className="card" style={{ background: 'var(--bg-hover)' }}>
          <div className="flex-row"><span className="color-muted">{t('total')}</span><span className="ml-auto font-bold">{fmt(row.total)}</span></div>
        </div>
      </div>
    ),
    footer: <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('close')}</button>,
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('navSales')}</h1><p className="page-subtitle">{t('salesSubtitle')}</p></div>
        <div className="flex-row gap-2">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('exportServerRequired'))}>Excel</button>
          <button className="btn btn-primary" type="button" onClick={() => toast.info(t('saleUseDesktop'))}>{t('newSale')}</button>
        </div>
      </div>

      <div className="stats-grid mb-6">
        {[
          [t('todayRevenue'), fmt(stats.revenue), 'var(--metric-violet)'],
          [t('todayChecks'), stats.count, 'var(--metric-green)'],
          [t('averageCheck'), fmt(stats.avg), 'var(--metric-blue)'],
          [t('returns'), stats.returns, 'var(--metric-red)'],
        ].map(([label, value, color]) => (
          <div className="stat-card" key={label}><div className="stat-icon" style={{ background: color }}>•</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
        ))}
      </div>

      {error ? <div className="login-error mb-4">{error}</div> : null}

      <div className="card">
        <div className="filters-bar mb-4">
          <input className="filter-input" type="date" value={filters.from} onChange={(event) => patchFilter('from', event.target.value)} />
          <input className="filter-input" type="date" value={filters.to} onChange={(event) => patchFilter('to', event.target.value)} />
          <select className="filter-input" value={filters.type} onChange={(event) => patchFilter('type', event.target.value)}>
            <option value="">{t('allTypes')}</option><option value="sale">{t('navSales')}</option><option value="return">{t('returns')}</option>
          </select>
          <select className="filter-input" value={filters.pay} onChange={(event) => patchFilter('pay', event.target.value)}>
            <option value="">{t('allPayments')}</option><option value="cash">{t('cashFull')}</option><option value="card">{t('card')}</option><option value="debt">{t('debt')}</option>
          </select>
          <input className="filter-input" value={filters.search} onChange={(event) => patchFilter('search', event.target.value)} placeholder={t('searchByClient')} style={{ flex: 1, minWidth: 160 }} />
        </div>
        <DataTable
          rows={visible}
          columns={[
            { key: 'doc_id', label: t('checkNumber') },
            { key: 'time_create', label: t('dateTime'), render: (row) => fmtDateTime(row.time_create) },
            { key: 'doc_type', label: t('type'), render: (row) => <span className={`badge ${row.doc_type === 'return' ? 'badge-danger' : 'badge-muted'}`}>{row.doc_type === 'return' ? t('return') : t('sale')}</span> },
            { key: 'client_name', label: t('client'), render: (row) => row.client_name || t('retail') },
            { key: 'items_count', label: t('positions') },
            { key: 'pay_type', label: t('payment'), render: (row) => <PayBadge value={row.pay_type} /> },
            { key: 'total', label: t('amount'), render: (row) => <b className={row.doc_type === 'return' ? 'color-red' : ''}>{row.doc_type === 'return' ? '-' : ''}{fmt(row.total)}</b> },
          ]}
          actions={(row) => <button className="btn btn-ghost btn-sm" type="button" onClick={() => view(row)}>{t('open')}</button>}
        />
      </div>
    </div>
  );
}
