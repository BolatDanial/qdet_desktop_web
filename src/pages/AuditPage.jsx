import { DataTable } from '../components/DataTable.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function AuditPage() {
  const toast = useToast();
  const { t } = useI18n();
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">{t('navAudit')}</h1><p className="page-subtitle">{t('auditSubtitle')}</p></div><button className="btn btn-primary" type="button" onClick={() => toast.info(t('auditSelectWip'))}>{t('startAudit')}</button></div><div className="card mb-4"><div className="card-title mb-4">{t('activeAudits')}</div><p className="color-muted">{t('noActiveAudits')}</p></div><div className="card"><div className="card-title mb-4">{t('history')}</div><DataTable rows={[{ date: '10.05.2025', goods: 142, diff: '-3 / +1', status: t('completed') }, { date: '01.04.2025', goods: 98, diff: '0', status: t('completed') }]} columns={[{ key: 'date', label: t('date') }, { key: 'goods', label: t('positions') }, { key: 'diff', label: t('difference') }, { key: 'status', label: t('status'), render: (row) => <span className="badge badge-success">{row.status}</span> }]} /></div></div>;
}
