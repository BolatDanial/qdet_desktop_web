import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { sessionStore } from '../auth/session.js';

export function NktPage() {
  const toast = useToast();
  const modal = useModal();
  const { t } = useI18n();
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [serverDown, setServerDown] = useState(false);
  const [history, setHistory] = useState(() => sessionStore.get('nkt_history') || []);
  const [unmapped, setUnmapped] = useState([]);
  const [loading, setLoading] = useState(false);

  const saveHistory = (item) => {
    const next = [item, ...history.filter((row) => row.barcode !== item.barcode)].slice(0, 20);
    setHistory(next);
    sessionStore.set('nkt_history', next);
  };

  const search = async (value = query) => {
    const q = value.trim();
    if (!q) {
      toast.error(t('enterBarcodeOrName'));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await api.nkt.searchByBarcode(q);
      if (!data?.good_name && !data?.barcode) {
        setResult({ missing: q });
      } else {
        setServerDown(false);
        setResult(data);
        saveHistory(data);
      }
    } catch (event) {
      setServerDown(true);
      setResult({ error: event.message, missing: q });
    } finally {
      setLoading(false);
    }
  };

  const loadUnmapped = useCallback(async () => {
    setLoading(true);
    try {
      setUnmapped((await api.nkt.getUnmapped(50, [], false)) || []);
    } catch (event) {
      toast.error(t('loadListError', { message: event.message }));
      setUnmapped([]);
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (tab === 'wizard') loadUnmapped();
  }, [loadUnmapped, tab]);

  const openMapping = (good) => {
    modal.open({
      title: t('mappingTitle', { name: good.good_name }),
      size: '720px',
      body: <MappingForm good={good} onSaved={() => { modal.closeAll(); loadUnmapped(); }} />,
    });
  };

  const historyColumns = useMemo(() => [
    { key: 'barcode', label: t('barcode') },
    { key: 'good_name', label: `${t('name')} (RU)` },
    { key: 'vendor', label: t('brand') },
    { key: 'country', label: t('country') },
    { key: 'ntin', label: t('ntin') },
  ], [t]);

  return (
    <div className="fade-in">
      <div className="page-header flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 className="page-title">{t('nktTitle')}</h1><p className="page-subtitle">{t('nktSubtitle')}</p></div>
        <div className="flex-row gap-2">
          <button className={`btn ${tab === 'search' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setTab('search')}>{t('catalogSearch')}</button>
          <button className={`btn ${tab === 'wizard' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setTab('wizard')}>{t('mappingWizard')}</button>
          <a href="https://nationalcatalog.kz" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">nationalcatalog.kz</a>
        </div>
      </div>

      {serverDown ? <div className="card warning-card mb-4"><div className="font-bold text-sm">{t('serverUnavailable')}</div><p className="text-xs color-muted mt-1">{t('serverUnavailableHint')}</p></div> : null}

      {tab === 'search' ? (
        <>
          <div className="card mb-6">
            <div className="card-title mb-4">{t('productSearch')}</div>
            <div className="nkt-search-box">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} placeholder={t('enterBarcodeOrNameLong')} />
              <button className="btn btn-primary" type="button" disabled={loading} onClick={() => search()}>{loading ? t('searching') : t('search')}</button>
            </div>
          </div>

          {result ? <NktResult result={result} /> : null}
          <div className="card">
            <div className="card-header"><div className="card-title">{t('searchHistory')}</div><button className="btn btn-ghost btn-sm" type="button" onClick={() => { sessionStore.remove('nkt_history'); setHistory([]); }}>{t('clear')}</button></div>
            <DataTable rows={history} columns={historyColumns} actions={(row) => <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setQuery(row.barcode); search(row.barcode); }}>{t('repeat')}</button>} />
          </div>
        </>
      ) : (
        <div className="card mb-6">
          <div className="card-header flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title">{t('unmappedNktGoods')}</div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={loadUnmapped}>{t('refreshList')}</button>
          </div>
          {loading ? <div className="spinner-ring" style={{ margin: '30px auto' }} /> : (
            <DataTable
              rows={unmapped}
              columns={[
                { key: 'good_name', label: t('name') },
                { key: 'good_barcode', label: t('barcode') },
                { key: 'good_category', label: t('category') },
              ]}
              actions={(row) => <button className="btn btn-primary btn-sm" type="button" onClick={() => openMapping(row)}>{t('map')}</button>}
            />
          )}
        </div>
      )}
    </div>
  );
}

function NktResult({ result }) {
  const toast = useToast();
  const { t } = useI18n();
  if (result.missing) return <div className="card mb-4"><div className="empty-state"><h3>{t('productNotFound')}</h3><p>{t('nktMissing', { query: result.missing })}</p></div></div>;
  return (
    <div className="nkt-result-card mb-4 fade-in">
      <div className="nkt-result-header">
        <div className="nkt-photo" style={{ display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 32 }}>📦</div>
        <div className="nkt-info" style={{ flex: 1 }}>
          <h3>{result.good_name || '—'}</h3>
          <p className="color-muted text-sm">{result.good_name_kz || ''}</p>
          <div className="nkt-meta">
            {result.vendor ? <span className="badge badge-info">{result.vendor}</span> : null}
            {result.country ? <span className="badge badge-muted">{result.country}</span> : null}
            {result.category ? <span className="badge badge-muted">{result.category}</span> : null}
          </div>
        </div>
      </div>
      <div className="grid-2 mt-4">
        <div><p className="text-xs color-muted">{t('barcode').toUpperCase()}</p><p className="font-bold">{result.barcode || '—'}</p></div>
        <div><p className="text-xs color-muted">{t('ntin')}</p><p className="font-bold color-accent">{result.ntin || '—'}</p></div>
        <div><p className="text-xs color-muted">{t('fullName')}</p><p className="text-sm">{result.full_name_ru || '—'}</p></div>
      </div>
      <div className="flex-row mt-4 gap-2 flex-wrap">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard.writeText(result.ntin || '').then(() => toast.success(t('ntinCopied')))}>{t('copyNtin')}</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard.writeText(result.barcode || '').then(() => toast.success(t('barcodeCopied')))}>{t('copyBarcode')}</button>
      </div>
    </div>
  );
}

function MappingForm({ good, onSaved }) {
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState({ barcode: good.good_barcode || '', ntin: '', tnved: '3004900002', origin: '5', vendor: good.vendor || '', description: good.good_name || '', descriptionKz: '' });
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.ntin || !form.barcode) {
      toast.error(t('enterNtinAndBarcode'));
      return;
    }
    await api.nkt.mapGood({ good_id: good.good_id, barcode: form.barcode, ntin: form.ntin, tnved: form.tnved, tru_origin_code: form.origin, description: form.description || null, description_kz: form.descriptionKz || null, vendor: form.vendor || null, good_name_kz: form.descriptionKz || null });
    toast.success(t('mappingSaved'));
    onSaved();
  };
  return (
    <div className="flex-col gap-3">
      <div className="card" style={{ background: 'var(--bg-hover)' }}><div className="font-bold">{good.good_name}</div><div className="text-sm color-muted mt-1">{t('barcode')}: {good.good_barcode || t('missing')}</div></div>
      <div className="grid-2 gap-3">
        {[
          ['ntin', t('ntinCode')], ['barcode', t('barcode')], ['tnved', t('tnvedCode')], ['origin', t('originCode')], ['vendor', t('vendor')], ['description', t('descriptionRu')], ['descriptionKz', t('descriptionKz')],
        ].map(([key, label]) => <div className="input-group" key={key}><label>{label}</label><input value={form[key]} onChange={(event) => patch(key, event.target.value)} /></div>)}
      </div>
      <button className="btn btn-primary" type="button" onClick={save}>{t('saveMapping')}</button>
    </div>
  );
}
