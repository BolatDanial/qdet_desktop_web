import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';

export function ClientsPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.sales.fetchClients().then((data) => setClients(data || [])).catch(() => setClients([]));
  }, []);

  const visible = search ? clients.filter((client) => JSON.stringify(client).toLowerCase().includes(search.toLowerCase())) : clients;
  const create = () => modal.open({
    title: t('newClient'),
    body: (
      <div className="flex-col gap-3">
        <div className="input-group"><label>{t('personName')}</label><input type="text" placeholder={t('sampleClientName')} /></div>
        <div className="input-group"><label>{t('phone')}</label><input type="tel" placeholder="+7 777 123 45 67" /></div>
        <div className="input-group"><label>{t('iin')}</label><input type="text" placeholder="900101300411" maxLength={12} /></div>
        <div className="input-group"><label>{t('address')}</label><input type="text" placeholder={t('sampleAddress')} /></div>
      </div>
    ),
    footer: (
      <>
        <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('cancel')}</button>
        <button className="btn btn-primary" type="button" onClick={() => { toast.success(t('clientAdded')); modal.closeAll(); }}>{t('save')}</button>
      </>
    ),
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('navClients')}</h1><p className="page-subtitle">{t('clientsSubtitle')}</p></div>
        <button className="btn btn-primary" type="button" onClick={create}>{t('addClient')}</button>
      </div>
      <div className="card">
        <div className="filters-bar"><input className="filter-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} style={{ flex: 1 }} /></div>
        <DataTable
          rows={visible}
          columns={[
            { key: 'client_name', label: t('personName') },
            { key: 'phone_number', label: t('phone') },
            { key: 'iin', label: t('iin') },
            { key: 'address', label: t('address') },
            { key: 'discount', label: t('discount'), render: (row) => row.discount ? `${row.discount}%` : '—' },
          ]}
          actions={(row) => <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('clientDebts', { id: row.client_id }))}>{t('debts')}</button>}
        />
      </div>
    </div>
  );
}
