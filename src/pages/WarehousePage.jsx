import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function WarehousePage() {
  const toast = useToast();
  const { t } = useI18n();
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">{t('warehouseTitle')}</h1></div><div className="flex-row gap-2"><button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('exportExcel'))}>Excel</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('goToAudit'))}>{t('navAudit')}</button></div></div><div className="card"><div className="filters-bar"><input className="filter-input" placeholder={t('searchGoods')} style={{ flex: 1 }} /><select className="filter-input"><option>{t('allWarehouses')}</option></select><label className="flex-row gap-2 text-sm"><input type="checkbox" /> {t('stockOnly')}</label></div><p className="color-muted p-4">{t('connectServerStocks')}</p></div></div>;
}
