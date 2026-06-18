import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { fmt, fmtDateTime } from '../utils/format.js';

export function PurchasesPage() {
  const modal = useModal();
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 10;

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.purchases.getDocuments({ limit, offset }).then((response) => active && setRows(response?.data || [])).catch(() => active && setRows([])).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [offset]);

  const viewDetails = async (doc) => {
    const loadingId = modal.open({ title: t('purchaseInvoice'), size: '720px', body: <div className="spinner-ring" style={{ margin: '40px auto' }} /> });
    try {
      const response = await api.purchases.getDetails(doc.doc_id);
      const items = response?.data || [];
      const totalCost = items.reduce((sum, item) => sum + (item.qty || 0) * (item.cost_price || 0), 0);
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
      modal.close(loadingId);
      modal.open({
        title: t('purchaseInvoiceWithNumber', { id: doc.doc_id?.substring(0, 8) || '' }),
        size: '720px',
        body: (
          <div className="flex-col gap-3">
            <div className="card" style={{ background: 'var(--bg-hover)' }}>
              <div className="grid-2">
                <div><span className="color-muted text-xs">{t('positions')}:</span><div className="font-bold text-lg">{items.length}</div></div>
                <div><span className="color-muted text-xs">{t('itemsTotal')}</span><div className="font-bold text-lg">{totalQty}</div></div>
                <div><span className="color-muted text-xs">{t('purchaseCost')}</span><div className="font-bold text-lg color-green">{fmt(totalCost)}</div></div>
              </div>
            </div>
            <DataTable
              rows={items}
              columns={[
                { key: 'good_name', label: t('product') },
                { key: 'qty', label: t('qty'), render: (item) => `${item.qty} ${item.unit_name || ''}` },
                { key: 'cost_price', label: t('costPrice'), render: (item) => fmt(item.cost_price) },
                { key: 'retail_price', label: t('retailPrice'), render: (item) => fmt(item.retail_price) },
                { key: 'total', label: t('purchaseCost'), render: (item) => fmt((item.qty || 0) * (item.cost_price || 0)) },
              ]}
            />
          </div>
        ),
        footer: <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('close')}</button>,
      });
    } catch (event) {
      modal.close(loadingId);
      modal.open({ title: t('error'), body: <p className="color-red p-4">{t('loadDocumentDetailsError', { message: event.message })}</p>, footer: <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('close')}</button> });
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">{t('navPurchases')}</h1><p className="page-subtitle">{t('purchasesSubtitle')}</p></div></div>
      <div className="card mt-4">
        <div className="flex-row gap-2 mb-4 align-center justify-between">
          <span className="font-bold text-sm">{t('documentList')}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOffset(0)}>{t('refresh')}</button>
        </div>
        {loading ? <div className="spinner-ring" style={{ margin: '40px auto' }} /> : (
          <DataTable
            rows={rows}
            columns={[
              { key: 'doc_id', label: t('docNumber'), render: (row) => row.doc_id ? row.doc_id.substring(0, 8) : '—' },
              { key: 'doc_date', label: t('date'), render: (row) => fmtDateTime(row.doc_date) },
              { key: 'supplier_name', label: t('supplier') },
              { key: 'warehouse_name', label: t('warehouse') },
              { key: 'status_name', label: t('status'), render: (row) => <span className={`badge ${row.status_name === 'Проведен' ? 'badge-success' : 'badge-warning'}`}>{row.status_name === 'Проведен' ? t('posted') : row.status_name || '—'}</span> },
            ]}
            actions={(row) => <button className="btn btn-ghost btn-sm" type="button" onClick={() => viewDetails(row)}>{t('open')}</button>}
          />
        )}
        <div className="flex-row justify-between align-center mt-4">
          <div className="text-xs color-muted">{rows.length ? t('shownDocuments', { from: offset + 1, to: offset + rows.length }) : t('noDocuments')}</div>
          <div className="flex-row gap-2">
            <button className="btn btn-ghost btn-sm" type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>{t('back')}</button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={rows.length < limit} onClick={() => setOffset((value) => value + limit)}>{t('next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
