import { useState } from 'react';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function ReportsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [active, setActive] = useState(null);
  const reports = [
    [t('navSales'), t('reportSalesDesc')],
    [t('reportStock'), t('reportStockDesc')],
    [t('reportDebts'), t('reportDebtsDesc')],
    [t('navPurchases'), t('reportPurchasesDesc')],
    [t('reportReturns'), t('reportReturnsDesc')],
    [t('reportProfit'), t('reportProfitDesc')],
  ];
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">{t('navReports')}</h1><p className="page-subtitle">{t('reportsSubtitle')}</p></div></div><div className="grid-3 mb-6">{reports.map(([title, desc]) => <button className="stat-card" style={{ cursor: 'pointer', textAlign: 'left' }} type="button" key={title} onClick={() => setActive(title)}><div className="card-title mt-4">{title}</div><div className="text-sm color-muted mt-2">{desc}</div></button>)}</div>{active ? <div className="card fade-in"><div className="card-header"><div className="card-title">{t('reportParams', { name: active })}</div></div><div className="flex-row gap-3 mb-4"><div className="input-group" style={{ flex: 1 }}><label>{t('from')}</label><input type="date" defaultValue={new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)} /></div><div className="input-group" style={{ flex: 1 }}><label>{t('to')}</label><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><div style={{ alignSelf: 'flex-end', paddingBottom: 16 }}><button className="btn btn-primary" type="button" onClick={() => toast.info(t('generatingReport'))}>{t('generate')}</button><button className="btn btn-ghost" type="button" onClick={() => toast.info(t('exportExcel'))}>Excel</button></div></div><p className="color-muted text-sm">{t('connectServerReports')}</p></div> : null}</div>;
}
