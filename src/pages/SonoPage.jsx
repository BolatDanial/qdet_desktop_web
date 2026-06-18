import { useState } from 'react';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const forms = {
  '910.00': { nameKey: 'simplifiedDeclaration', fields: ['binIin', 'period', 'income', 'tax'] },
  '300.00': { nameKey: 'vatDeclaration', fields: ['taxpayerBin', 'taxPeriod', 'turnover', 'vatAccrued', 'vatDeductible'] },
  '200.00': { nameKey: 'personalSocialDeductions', fields: ['employerBin', 'period', 'payroll', 'iin', 'socialDeductions', 'medicalInsurance', 'pension'] },
  '100.00': { nameKey: 'corporateTax', fields: ['bin', 'taxYear', 'income', 'expenses', 'corporateTax'] },
};

export function SonoPage() {
  const modal = useModal();
  const toast = useToast();
  const { t } = useI18n();
  const [active, setActive] = useState(null);
  const upload = () => modal.open({ title: t('uploadEcp'), body: <div className="flex-col gap-3"><p className="text-sm color-muted">{t('uploadEcpHint')}</p><div className="input-group"><label>{t('certificateFile')}</label><input type="file" accept=".p12" /></div><div className="input-group"><label>{t('password')}</label><input type="password" /></div></div>, footer: <><button className="btn btn-ghost" type="button" onClick={modal.closeAll}>{t('cancel')}</button><button className="btn btn-primary" type="button" onClick={() => { toast.success(t('ecpUploaded')); modal.closeAll(); }}>{t('connect')}</button></> });
  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">{t('sonoTitle')}</h1><p className="page-subtitle">{t('sonoSubtitle')}</p></div><a href="https://cabinet.salyk.kz" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">{t('openKgdOffice')}</a></div>
      <div className="card warning-card mb-6"><div className="flex-row gap-3"><div><div className="font-bold">{t('ecpRequired')}</div><p className="text-sm color-muted">{t('ecpOptional')}</p></div><button className="btn btn-primary btn-sm ml-auto" type="button" onClick={upload}>{t('uploadEcp')}</button></div></div>
      <div className="grid-2 mb-6">
        <div className="card"><div className="card-title mb-4">{t('upcomingDeadlines')}</div><div className="flex-col gap-3">{Object.entries(forms).map(([code, form]) => <div className="deadline-row flex-row" key={code}><div className="badge badge-info" style={{ minWidth: 60, justifyContent: 'center' }}>{code}</div><div style={{ flex: 1 }}><div className="font-bold text-sm">{t(form.nameKey)}</div><div className="text-xs color-muted">{t('dueBy', { date: '2026-06-15' })}</div></div><button className="btn btn-ghost btn-sm" type="button" onClick={() => setActive(code)}>{t('generate')}</button></div>)}</div></div>
        <div className="card"><div className="card-title mb-4">{t('submissionHistory')}</div><DataTable rows={[{ form: '910.00', period: t('sampleTaxPeriodHalf'), sent: '15.01.2025', status: t('accepted') }, { form: '300.00', period: t('sampleTaxPeriodMonth'), sent: '15.01.2025', status: t('accepted') }]} columns={[{ key: 'form', label: t('form') }, { key: 'period', label: t('period') }, { key: 'sent', label: t('sent') }, { key: 'status', label: t('status'), render: (row) => <span className="badge badge-success">{row.status}</span> }]} /></div>
      </div>
      {active ? <div className="card fade-in"><div className="card-header"><div><div className="card-title">{t('formTitle', { code: active, name: t(forms[active].nameKey) })}</div><div className="card-subtitle">{t('prefill')}</div></div><button className="btn btn-ghost btn-sm" type="button" onClick={() => setActive(null)}>{t('close')}</button></div><div className="grid-2 mb-4">{forms[active].fields.map((field) => <div className="input-group" key={field}><label>{t(field)}</label><input placeholder={t('enterValue')} /></div>)}</div><div className="flex-row gap-2"><button className="btn btn-primary" type="button" onClick={() => toast.info(t('draftSaved'))}>{t('saveDraft')}</button><button className="btn btn-ghost" type="button" onClick={() => toast.info(t('exportPdf'))}>{t('exportPdf')}</button><button className="btn btn-ghost ml-auto" type="button" onClick={() => toast.info(t('uploadEcpToSend'))}>{t('sendToKgd')}</button></div></div> : null}
    </div>
  );
}
