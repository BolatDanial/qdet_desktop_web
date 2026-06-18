import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function KaspiPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const connect = () => modal.open({ title: t('connectKaspiApi'), body: <div className="flex-col gap-3"><p className="text-sm color-muted">{t('kaspiApiHint')}</p><div className="input-group"><label>API Token</label><input type="password" /></div><div className="input-group"><label>Merchant ID</label><input /></div></div>, footer: <><button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('cancel')}</button><button className="btn btn-primary" type="button" onClick={() => { toast.success(t('kaspiApiConnected')); modal.closeAll(); }}>{t('save')}</button></> });
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">{t('navKaspi')}</h1><p className="page-subtitle">{t('kaspiSubtitle')}</p></div><a href="https://kaspi.kz/shop/merchant" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">{t('kaspiOffice')}</a></div><div className="card marketplace-card kaspi-card mb-6"><div className="flex-row gap-3"><div><div className="card-title">{t('navKaspi')} API</div><p className="text-sm color-muted">{t('kaspiApiDescription')}</p></div><button className="btn btn-primary ml-auto" type="button" onClick={connect}>{t('connect')}</button></div></div><div className="grid-3 mb-6"><div className="stat-card"><div className="stat-value">—</div><div className="stat-label">{t('activeGoods')}</div></div><div className="stat-card"><div className="stat-value">—</div><div className="stat-label">{t('todayOrders')}</div></div><div className="stat-card"><div className="stat-value">—</div><div className="stat-label">{t('revenue')}</div></div></div></div>;
}
