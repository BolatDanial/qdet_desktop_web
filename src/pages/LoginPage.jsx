import { ArrowLeft, MessageSquareText, QrCode, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

const POLL_INTERVAL_MS = 2000;
const RESEND_COOLDOWN_SECONDS = 60;
const PHONE_PREFIX_LENGTH = 4; // "+7 ("

function formatPhone(tail = '') {
  const digits = tail.replace(/\D/g, '').slice(0, 10);
  let result = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) result += ')';
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 10)}`;
  return result;
}

function getPhoneTail(value) {
  const numeric = value.replace(/\D/g, '');
  // The field contains the fixed country prefix (+7), so only retain the
  // subscriber digits that follow it. Do not inject an additional leading 7.
  return (numeric.startsWith('7') ? numeric.slice(1) : numeric).slice(0, 10);
}

function subscriberDigitsBefore(value, caret) {
  // The first digit in every rendered value is the fixed country code (7).
  return Math.max(0, value.slice(0, caret).replace(/\D/g, '').length - 1);
}

function caretForSubscriberDigit(formatted, digitCount) {
  if (!digitCount) return PHONE_PREFIX_LENGTH;
  let seen = 0;
  for (let index = PHONE_PREFIX_LENGTH; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) seen += 1;
    if (seen === digitCount) return index + 1;
  }
  return formatted.length;
}

function qrStatusText(status, t) {
  if (status === 'generating') return t('qrGenerating');
  if (status === 'waiting') return t('qrWaiting');
  if (status === 'authorized') return t('qrAuthorized');
  if (status === 'expired') return t('qrExpired');
  if (status === 'failed') return t('qrFailed');
  return t('qrIdle');
}

function smsError(status, t) {
  if (status === 'wrong_code') return t('smsWrongCode');
  if (status === 'expired') return t('smsExpired');
  if (status === 'limit') return t('smsLimit');
  if (status === 'blocked') return t('smsBlocked');
  return t('smsGenericError');
}

export function LoginPage() {
  const auth = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState('qr');
  const [qr, setQr] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [qrStatus, setQrStatus] = useState('generating');
  const [phoneTail, setPhoneTail] = useState('');
  const [smsStep, setSmsStep] = useState('phone');
  const [smsCode, setSmsCode] = useState(['', '', '', '']);
  const [smsBusy, setSmsBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const pollRef = useRef(null);
  const otpRefs = useRef([]);
  const smsSubmittingRef = useRef(false);
  const phoneInputRef = useRef(null);
  const phoneCaretRef = useRef(null);

  useLayoutEffect(() => {
    if (phoneCaretRef.current === null || document.activeElement !== phoneInputRef.current) return;
    const input = phoneInputRef.current;
    const position = caretForSubscriberDigit(input.value, phoneCaretRef.current);
    input.setSelectionRange(position, position);
    phoneCaretRef.current = null;
  }, [phoneTail]);

  const stopQrFlow = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  const failQrFlow = useCallback(() => {
    setQr(null); setQrImage(''); setQrStatus('failed'); setError(t('qrCreateError'));
  }, [t]);

  const startQrLogin = useCallback(async () => {
    stopQrFlow(); setQrStatus('generating'); setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await api.webAuth.generateQr({ signal: controller.signal });
      if (!data?.token || !data?.expires_at) throw new Error('incomplete QR response');
      const image = await QRCode.toDataURL(data.token, { errorCorrectionLevel: 'M', margin: 2, scale: 8 });
      setQr(data); setQrImage(image); setQrStatus('waiting');
    } catch (event) {
      if (event.name !== 'AbortError') failQrFlow();
    }
  }, [failQrFlow, stopQrFlow]);

  const switchMode = useCallback((nextMode) => {
    setError('');
    if (nextMode === 'sms') {
      stopQrFlow(); setMode('sms'); setSmsStep('phone'); setSmsCode(['', '', '', '']);
    } else {
      setMode('qr');
    }
  }, [stopQrFlow]);

  useEffect(() => {
    if (mode === 'qr') startQrLogin();
    return stopQrFlow;
  }, [mode, startQrLogin, stopQrFlow]);

  useEffect(() => {
    if (mode !== 'qr' || !qr?.token || qrStatus !== 'waiting') return undefined;
    const poll = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await api.webAuth.qrStatus(qr.token, { signal: controller.signal });
        if (data?.status === 'pending') pollRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
        else if (data?.status === 'authorized') {
          setQrStatus('authorized');
          await auth.completeWebLogin(await api.webAuth.qrExchange(qr.token, { signal: controller.signal }));
        } else if (data?.status === 'expired') setQrStatus('expired');
        else failQrFlow();
      } catch (event) {
        if (event.name !== 'AbortError') failQrFlow();
      }
    };
    pollRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => window.clearTimeout(pollRef.current);
  }, [auth, failQrFlow, mode, qr, qrStatus]);

  useEffect(() => {
    if (!resendIn) return undefined;
    const interval = window.setInterval(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [resendIn]);

  const sendSms = useCallback(async () => {
    const phone = formatPhone(phoneTail);
    if (phoneTail.length !== 10) return setError(t('smsPhoneInvalid'));
    setSmsBusy(true); setError('');
    try {
      const known = await api.webAuth.checkPhone(phone);
      if (!known?.is_exist) throw new Error('unknown');
      const result = await api.webAuth.sendSmsWeb(phone);
      if (result?.status !== 'ok') throw new Error(result?.status || 'error');
      setSmsStep('code'); setSmsCode(['', '', '', '']); setResendIn(RESEND_COOLDOWN_SECONDS);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (event) {
      setError(smsError(event?.data?.status || event.message, t));
    } finally { setSmsBusy(false); }
  }, [phoneTail, t]);

  const checkSms = useCallback(async (code) => {
    if (code.length !== 4 || smsSubmittingRef.current) return;
    smsSubmittingRef.current = true; setSmsBusy(true); setError('');
    try {
      const result = await api.webAuth.checkSmsWeb(formatPhone(phoneTail), code);
      if (result?.status !== 'ok' || !result?.access_token) throw new Error(result?.status || 'error');
      await auth.completeWebLogin(result);
    } catch (event) {
      setError(smsError(event?.data?.status || event.message, t)); setSmsCode(['', '', '', '']);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } finally { smsSubmittingRef.current = false; setSmsBusy(false); }
  }, [auth, phoneTail, t]);

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return setSmsCode((current) => current.map((digit, position) => (position === index ? '' : digit)));
    const next = [...smsCode];
    digits.slice(0, 4 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
    setSmsCode(next);
    const lastIndex = Math.min(3, index + digits.length - 1);
    if (lastIndex < 3) otpRefs.current[lastIndex + 1]?.focus();
    if (next.join('').length === 4) checkSms(next.join(''));
  };

  const updatePhone = (value, caret) => {
    const nextTail = getPhoneTail(value);
    phoneCaretRef.current = Math.min(subscriberDigitsBefore(value, caret), nextTail.length);
    setPhoneTail(nextTail);
  };

  const deletePhoneDigit = (index) => {
    if (index < 0 || index >= phoneTail.length) return;
    phoneCaretRef.current = index;
    setPhoneTail(`${phoneTail.slice(0, index)}${phoneTail.slice(index + 1)}`);
  };

  const handlePhoneKeyDown = (event) => {
    const input = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value } = input;
    if (start === null || end === null || start !== end) return;

    if (event.key === 'Backspace') {
      if (start <= PHONE_PREFIX_LENGTH) {
        event.preventDefault();
        phoneCaretRef.current = 0;
        return;
      }
      if (!/\d/.test(value[start - 1])) {
        event.preventDefault();
        deletePhoneDigit(subscriberDigitsBefore(value, start) - 1);
      }
    }

    if (event.key === 'Delete') {
      if (start < PHONE_PREFIX_LENGTH) {
        event.preventDefault();
        phoneCaretRef.current = 0;
        return;
      }
      if (!/\d/.test(value[start])) {
        event.preventDefault();
        deletePhoneDigit(subscriberDigitsBefore(value, start));
      }
    }
  };

  const qrBusy = qrStatus === 'generating' || qrStatus === 'authorized';
  const hasQr = Boolean(qrImage && qr?.token);

  return <div className="screen active"><div className="login-bg" /><div className="login-container">
    <div className="login-logo"><div className="logo-icon"><Logo size={48} /></div><div className="logo-text"><h1>QDET Web</h1><p>{t('appSubtitle')}</p></div></div>
    <div className="login-card glass-card qr-login-card">
      {mode === 'qr' ? <div className="form-step"><h2>{t('qrLogin')}</h2><p className="form-subtitle">{qrStatusText(qrStatus, t)}</p>
        {hasQr ? <div className="qr-box"><img src={qrImage} alt={t('qrAlt')} /></div> : <div className={`qr-placeholder ${qrBusy ? 'qr-placeholder-loading' : ''}`}>{qrBusy ? <div className="spinner-ring" /> : <Smartphone size={42} />}</div>}
        <button className="btn btn-primary btn-full" type="button" disabled={qrBusy} onClick={() => switchMode('sms')}><MessageSquareText size={18} /><span>{t('loginByPhone')}</span></button>
      </div> : smsStep === 'phone' ? <div className="form-step"><h2>{t('phoneLogin')}</h2><p className="form-subtitle">{t('phoneLoginHint')}</p>
        <div className="input-group"><label htmlFor="web-login-phone">{t('phone')}</label><input ref={phoneInputRef} id="web-login-phone" inputMode="tel" autoComplete="tel" value={formatPhone(phoneTail)} onFocus={(event) => { if (!phoneTail) event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length); }} onClick={(event) => { if ((event.currentTarget.selectionStart ?? PHONE_PREFIX_LENGTH) < PHONE_PREFIX_LENGTH) event.currentTarget.setSelectionRange(PHONE_PREFIX_LENGTH, PHONE_PREFIX_LENGTH); }} onChange={(event) => updatePhone(event.target.value, event.target.selectionStart ?? event.target.value.length)} onKeyDown={handlePhoneKeyDown} /></div>
        <button className="btn btn-primary btn-full" type="button" disabled={smsBusy || phoneTail.length !== 10} onClick={sendSms}>{smsBusy ? t('sending') : t('sendCode')}</button>
        <button className="btn btn-ghost btn-full" type="button" onClick={() => switchMode('qr')}><QrCode size={18} /><span>{t('loginByQr')}</span></button>
      </div> : <div className="form-step"><button className="login-back" type="button" onClick={() => { setSmsStep('phone'); setError(''); }}><ArrowLeft size={17} /> {t('changePhone')}</button><h2>{t('enterSmsCode')}</h2><p className="form-subtitle">{t('codeSentTo')} {formatPhone(phoneTail)}</p>
        <div className="otp-inputs">{smsCode.map((digit, index) => <input key={index} ref={(element) => { otpRefs.current[index] = element; }} className="otp-input" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength="4" value={digit} disabled={smsBusy} onChange={(event) => handleOtpChange(index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !smsCode[index] && index > 0) otpRefs.current[index - 1]?.focus(); }} aria-label={`${t('smsCodeDigit')} ${index + 1}`} />)}</div>
        <button className="login-resend" type="button" disabled={smsBusy || resendIn > 0} onClick={sendSms}>{resendIn > 0 ? `${t('resendCode')} (${resendIn} ${t('secondsShort')})` : t('resendCode')}</button>
        <button className="btn btn-ghost btn-full" type="button" onClick={() => switchMode('qr')}><QrCode size={18} /><span>{t('loginByQr')}</span></button>
      </div>}
      {error ? <div className="login-error">{error}</div> : null}
    </div><div className="login-footer"><p>QDET Web v1.0.0 · Kazakhstan</p></div>
  </div></div>;
}
