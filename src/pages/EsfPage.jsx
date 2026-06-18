import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { fmt } from '../utils/format.js';

export function EsfPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const [docs, setDocs] = useState([]);
  const [filters, setFilters] = useState({ type: '', status: '', from: '', to: '' });

  const load = useCallback(() => {
    api.esf
      .getList({ type: filters.type, status: filters.status, date_from: filters.from, date_to: filters.to })
      .then((data) => setDocs(data || []))
      .catch((event) => toast.error(t('loadEsfError', { message: event.message })));
  }, [filters.from, filters.status, filters.to, filters.type, t, toast]);

  useEffect(load, [load]);

  const visible = useMemo(() => docs.filter((doc) => (!filters.type || doc.type === filters.type) && (!filters.status || doc.status === filters.status)), [docs, filters.status, filters.type]);
  const counts = { out: docs.filter((d) => d.type === 'out').length, in: docs.filter((d) => d.type === 'in').length, pending: docs.filter((d) => d.status === 'new' || d.status === 'sent').length, cancelled: docs.filter((d) => d.status === 'cancelled').length };
  const create = () => modal.open({ title: t('issueNewEsf'), size: '900px', body: <EsfForm />, footer: <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('close')}</button> });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('esfTitle')}</h1><p className="page-subtitle">{t('esfSubtitle')}</p></div>
        <button className="btn btn-primary" type="button" onClick={create}>{t('issueEsf')}</button>
      </div>
      <div className="stats-grid mb-6">
        {[[counts.out, t('outgoing')], [counts.in, t('incoming')], [counts.pending, t('pendingConfirm')], [counts.cancelled, t('cancelled')]].map(([value, label]) => <div className="stat-card" key={label}><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>)}
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{t('esfRegistry')}</div>
          <div className="flex-row gap-2">
            <select className="filter-input" value={filters.type} onChange={(event) => setFilters((f) => ({ ...f, type: event.target.value }))}><option value="">{t('allTypes')}</option><option value="out">{t('outgoing')}</option><option value="in">{t('incoming')}</option></select>
            <select className="filter-input" value={filters.status} onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}><option value="">{t('allStatuses')}</option><option value="new">{t('newStatus')}</option><option value="sent">{t('sentStatus')}</option><option value="confirmed">{t('confirmedStatus')}</option><option value="cancelled">{t('cancelledStatus')}</option></select>
            <input className="filter-input" type="date" value={filters.from} onChange={(event) => setFilters((f) => ({ ...f, from: event.target.value }))} />
            <input className="filter-input" type="date" value={filters.to} onChange={(event) => setFilters((f) => ({ ...f, to: event.target.value }))} />
          </div>
        </div>
        <DataTable
          rows={visible}
          columns={[
            { key: 'num', label: '№ ЭСФ' },
            { key: 'date', label: t('date') },
            { key: 'type', label: t('type'), render: (row) => <span className={`badge ${row.type === 'out' ? 'badge-info' : 'badge-muted'}`}>{row.type === 'out' ? t('outgoingOne') : t('incomingOne')}</span> },
            { key: 'counterparty', label: t('counterparty'), render: (row) => <div><div className="font-bold">{row.counterparty}</div><div className="text-xs color-muted">{t('bin')}: {row.bin}</div></div> },
            { key: 'total', label: t('amount'), render: (row) => <div className="font-bold">{fmt(row.total)}<div className="text-xs color-muted">{t('vat')}: {fmt(row.vat)}</div></div> },
            { key: 'status', label: t('status'), render: (row) => <span className={`badge ${row.status === 'confirmed' ? 'badge-success' : row.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{row.status || '—'}</span> },
          ]}
          actions={() => <button className="btn btn-ghost btn-sm" type="button">{t('open')}</button>}
        />
      </div>
    </div>
  );
}

function EsfForm() {
  const toast = useToast();
  const { t } = useI18n();
  const [items, setItems] = useState([{ name: '', qty: 1, price: 0, vatRate: 12, tnved: '3004900002', origin: '5' }]);
  const update = (index, key, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const total = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const vat = total * 0.12;
  const send = async () => {
    await api.esf.send({ items, total, vat }).catch((event) => toast.error(t('sendError', { message: event.message })));
    toast.success(t('esfReady'));
  };
  return (
    <div className="esf-form-container full-form">
      <div className="grid-3 gap-4">
        <div className="input-group"><label>{t('invoiceNumber')}</label><input placeholder="ЭСФ-001" /></div>
        <div className="input-group"><label>{t('issueDate')}</label><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
        <div className="input-group"><label>{t('recipientBin')}</label><input maxLength={12} /></div>
      </div>
      <div className="section-group mt-4">
        <div className="flex-row items-center mb-4"><h4 className="section-title" style={{ marginBottom: 0 }}>{t('goodsAndServices')}</h4><button className="btn btn-ghost btn-sm ml-auto" type="button" onClick={() => setItems((rows) => [...rows, { name: '', qty: 1, price: 0, vatRate: 12, tnved: '3004900002', origin: '5' }])}>{t('addRow')}</button></div>
        <div className="table-wrapper">
          <table><thead><tr><th>{t('name')}</th><th>{t('tnved')}</th><th>{t('qty')}</th><th>{t('price')}</th><th>{t('total')}</th></tr></thead><tbody>{items.map((item, index) => <tr key={index}><td><input value={item.name} onChange={(event) => update(index, 'name', event.target.value)} /></td><td><input value={item.tnved} onChange={(event) => update(index, 'tnved', event.target.value)} /></td><td><input type="number" value={item.qty} onChange={(event) => update(index, 'qty', event.target.value)} /></td><td><input type="number" value={item.price} onChange={(event) => update(index, 'price', event.target.value)} /></td><td>{fmt(Number(item.qty || 0) * Number(item.price || 0))}</td></tr>)}</tbody></table>
        </div>
        <div className="esf-total-bar mt-4"><span>{t('totalWithoutVat')} <b>{fmt(total)}</b></span><span className="ml-8">{t('totalVat')} <b>{fmt(vat)}</b></span><span className="ml-auto">{t('grandTotal')} <b className="color-accent">{fmt(total + vat)}</b></span></div>
      </div>
      <button className="btn btn-primary mt-4" type="button" onClick={send}>{t('sendEsf')}</button>
    </div>
  );
}
