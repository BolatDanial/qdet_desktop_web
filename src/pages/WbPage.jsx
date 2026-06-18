import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function WbPage() {
  const toast = useToast();
  const { t } = useI18n();
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">Wildberries</h1><p className="page-subtitle">{t('wbSubtitle')}</p></div></div><div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}><h2 style={{ marginBottom: 8 }}>{t('soon')}</h2><p className="color-muted" style={{ maxWidth: 400, margin: '0 auto' }}>{t('wbWip')}</p><button className="btn btn-primary mt-4" type="button" onClick={() => toast.success(t('requestSent'))}>{t('leaveRequest')}</button></div></div>;
}
