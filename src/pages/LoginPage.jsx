import { RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

const POLL_INTERVAL_MS = 2000;
const QR_ERROR_MESSAGE = 'Не удалось создать QR код. Попробуйте снова';

function getTimeLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function statusText(status, t) {
  if (status === 'generating') return t('qrGenerating');
  if (status === 'waiting') return t('qrWaiting');
  if (status === 'authorized') return t('qrAuthorized');
  if (status === 'expired') return t('qrExpired');
  if (status === 'failed') return t('qrFailed');
  return t('qrIdle');
}

export function LoginPage() {
  const auth = useAuth();
  const { t } = useI18n();
  const [qr, setQr] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [status, setStatus] = useState('generating');
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const pollRef = useRef(null);
  const expiresRef = useRef(null);

  const stopFlow = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    if (expiresRef.current) {
      window.clearTimeout(expiresRef.current);
      expiresRef.current = null;
    }
  }, []);

  const failQrFlow = useCallback(() => {
    setQr(null);
    setQrImage('');
    setTimeLeft(0);
    setStatus('failed');
    setError(QR_ERROR_MESSAGE);
  }, []);

  const startQrLogin = useCallback(async () => {
    stopFlow();
    setStatus('generating');
    setError('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await api.webAuth.generateQr({ signal: controller.signal });
      if (!data?.token || !data?.expires_at) throw new Error(t('qrIncomplete'));

      const image = await QRCode.toDataURL(data.token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 8,
      });

      setQr(data);
      setQrImage(image);
      setStatus('waiting');
      setTimeLeft(getTimeLeft(data.expires_at));
    } catch (event) {
      if (event.name === 'AbortError') return;
      failQrFlow(event.message || t('qrCreateError'));
    }
  }, [failQrFlow, stopFlow, t]);

  useEffect(() => {
    startQrLogin();
  }, [startQrLogin]);

  useEffect(() => {
    if (!qr?.token || status !== 'waiting') return undefined;

    const poll = async () => {
      if (getTimeLeft(qr.expires_at) <= 0) {
        startQrLogin();
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await api.webAuth.qrStatus(qr.token, { signal: controller.signal });
        if (data?.status === 'pending') {
          pollRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (data?.status === 'authorized') {
          setStatus('authorized');
          const exchanged = await api.webAuth.qrExchange(qr.token, { signal: controller.signal });
          await auth.completeQrLogin(exchanged);
          return;
        }
        if (data?.status === 'expired') {
          startQrLogin();
          return;
        }
        failQrFlow(data?.error || t('qrAuthError'));
      } catch (event) {
        if (event.name === 'AbortError') return;
        failQrFlow(event.message || t('qrStatusError'));
      }
    };

    pollRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [auth, failQrFlow, qr, startQrLogin, status, t]);

  useEffect(() => {
    if (!qr?.expires_at || status !== 'waiting') return undefined;
    const tick = () => setTimeLeft(getTimeLeft(qr.expires_at));
    tick();
    const interval = window.setInterval(tick, 1000);
    expiresRef.current = window.setTimeout(startQrLogin, Math.max(0, new Date(qr.expires_at).getTime() - Date.now()));
    return () => {
      window.clearInterval(interval);
      if (expiresRef.current) window.clearTimeout(expiresRef.current);
    };
  }, [qr, startQrLogin, status]);

  useEffect(() => stopFlow, [stopFlow]);

  useEffect(() => {
    if (status === 'idle') return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [status]);

  const hasQr = Boolean(qrImage && qr?.token);
  const busy = status === 'generating' || status === 'authorized';
  const showLoadingQr = !hasQr && status === 'generating';

  return (
    <div className="screen active">
      <div className="login-bg" />
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon"><Logo size={48} /></div>
          <div className="logo-text">
            <h1>QDET Web</h1>
            <p>{t('appSubtitle')}</p>
          </div>
        </div>

        <div className="login-card glass-card qr-login-card">
          <div className="form-step">
            <h2>{t('qrLogin')}</h2>
            <p className="form-subtitle">{statusText(status, t)}</p>

            {hasQr ? (
              <div className="qr-box">
                <img src={qrImage} alt={t('qrAlt')} />
                <div className="qr-meta">
                  <span>{t('expiresIn')}</span>
                  <strong>{timeLeft} {t('secondsShort')}</strong>
                </div>
              </div>
            ) : showLoadingQr ? (
              <div className="qr-placeholder qr-placeholder-loading" aria-live="polite">
                <div className="spinner-ring" />
              </div>
            ) : (
              <div className="qr-placeholder">
                <Smartphone size={42} />
              </div>
            )}

            <button className="btn btn-primary btn-full" type="button" disabled={busy} onClick={startQrLogin}>
              <RefreshCw size={18} />
              <span>{t('issueNewQr')}</span>
            </button>
          </div>

          {error ? <div className="login-error">{error}</div> : null}
        </div>

        <div className="login-footer">
          <p>QDET Web v1.0.0 · Kazakhstan</p>
        </div>
      </div>
    </div>
  );
}
