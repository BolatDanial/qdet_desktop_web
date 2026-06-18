import { useState } from 'react';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const docs = [
  { num: 'СНТ-2025-001', date: '2025-05-10', fromKey: 'supplierCompany', toKey: 'ourStore', type: 'in', status: 'confirmed', goods: 15 },
  { num: 'СНТ-2025-002', date: '2025-05-11', fromKey: 'ourStore', toKey: 'clientCompany', type: 'out', status: 'sent', goods: 8 },
  { num: 'СНТ-2025-003', date: '2025-05-09', fromKey: 'otherCompany', toKey: 'ourStore', type: 'in', status: 'new', goods: 22 },
];

export function SntPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const [type, setType] = useState('');
  const visible = type ? docs.filter((doc) => doc.type === type) : docs;
  const statusLabel = (status) => ({ confirmed: t('confirmedStatus'), sent: t('sentStatus'), new: t('newStatus') })[status] || status;
  const create = () => modal.open({
    title: t('createSnt'),
    body: <div className="flex-col gap-3"><div className="input-group"><label>{t('recipientBin')}</label><input placeholder="123456789012" /></div><div className="input-group"><label>{t('recipientName')}</label><input placeholder={t('sampleCompanyName')} /></div><div className="input-group"><label>{t('shipmentDate')}</label><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><div className="input-group"><label>{t('invoiceWaybillNumber')}</label><input placeholder="НК-001" /></div></div>,
    footer: <><button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('cancel')}</button><button className="btn btn-primary" type="button" onClick={() => { toast.success(t('sntCreated')); modal.closeAll(); }}>{t('create')}</button></>,
  });
  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">{t('sntTitle')}</h1><p className="page-subtitle">{t('sntSubtitle')}</p></div><button className="btn btn-primary" type="button" onClick={create}>{t('createSnt')}</button></div>
      <div className="stats-grid mb-6"><div className="stat-card"><div className="stat-value">12</div><div className="stat-label">{t('outgoing')}</div></div><div className="stat-card"><div className="stat-value">8</div><div className="stat-label">{t('incoming')}</div></div><div className="stat-card"><div className="stat-value">3</div><div className="stat-label">{t('pending')}</div></div></div>
      <div className="card">
        <div className="card-header"><div className="card-title">{t('sntRegistry')}</div><select className="filter-input" value={type} onChange={(event) => setType(event.target.value)}><option value="">{t('all')}</option><option value="out">{t('outgoing')}</option><option value="in">{t('incoming')}</option></select></div>
        <DataTable rows={visible} columns={[{ key: 'num', label: '№ СНТ' }, { key: 'date', label: t('date') }, { key: 'from', label: t('sender'), render: (row) => row.fromKey ? t(row.fromKey) : row.from }, { key: 'to', label: t('recipient'), render: (row) => row.toKey ? t(row.toKey) : row.to }, { key: 'goods', label: t('positions') }, { key: 'status', label: t('status'), render: (row) => <span className={`badge ${row.status === 'confirmed' ? 'badge-success' : row.status === 'sent' ? 'badge-info' : 'badge-warning'}`}>{statusLabel(row.status)}</span> }]} actions={() => <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('viewSnt'))}>{t('open')}</button>} />
      </div>
    </div>
  );
}
