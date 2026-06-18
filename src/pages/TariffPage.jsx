import { Check, CreditCard, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fmt, fmtDate } from '../utils/format.js';

const MONTH_PRESETS = [1, 3, 6, 12];

function queryParam(search, key) {
  return new URLSearchParams(search).get(key)?.trim() || '';
}

function normalizePhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '7';
  if (digits.startsWith('8')) return `7${digits.slice(1, 11)}`;
  if (digits.startsWith('7')) return digits.slice(0, 11);
  return `7${digits.slice(0, 10)}`;
}

function formatPhoneDigits(digitsValue) {
  const digits = normalizePhoneDigits(digitsValue);
  const code = digits.slice(1, 4);
  const first = digits.slice(4, 7);
  const second = digits.slice(7, 9);
  const third = digits.slice(9, 11);

  let formatted = '+7';
  if (code) formatted += ` (${code}`;
  if (code.length === 3) formatted += ')';
  if (first) formatted += ` ${first}`;
  if (second) formatted += `-${second}`;
  if (third) formatted += `-${third}`;
  return formatted;
}

function phoneIsComplete(digits) {
  return normalizePhoneDigits(digits).length === 11;
}

function removeDigitAt(digits, index) {
  if (index <= 0) return digits;
  return `${digits.slice(0, index)}${digits.slice(index + 1)}` || '7';
}

function digitPositions(digits) {
  const formatted = formatPhoneDigits(digits);
  const positions = [];
  let digitIndex = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) {
      positions.push({ index, digitIndex });
      digitIndex += 1;
    }
  }
  return positions;
}

function mergeShops(apiShops = [], authShops = [], requestedShopId = '') {
  const map = new Map();

  authShops.forEach((shop) => {
    if (!shop?.shop_id) return;
    map.set(String(shop.shop_id), {
      shop_id: String(shop.shop_id),
      shop_name: shop.shop_name || shop.name || '',
      phone: shop.phone || '',
    });
  });

  apiShops.forEach((shop) => {
    if (!shop?.shop_id) return;
    const id = String(shop.shop_id);
    const current = map.get(id) || { shop_id: id, shop_name: '', phone: '' };
    map.set(id, { ...current, phone: shop.phone || current.phone });
  });

  if (requestedShopId && !map.has(String(requestedShopId))) {
    map.set(String(requestedShopId), {
      shop_id: String(requestedShopId),
      shop_name: '',
      phone: '',
    });
  }

  return Array.from(map.values());
}

function shopLabel(shop) {
  if (!shop) return '';
  return shop.shop_name || shop.name || shop.phone || '';
}

function enrichCurrentTariff(currentTariff, tariffs) {
  if (!currentTariff) return null;
  const tariff = tariffs.find((item) => String(item.tariff_id) === String(currentTariff.tariff_id));
  return { ...tariff, ...currentTariff, promos: tariff?.promos || currentTariff.promos || [] };
}

function bestPromo(tariff, months) {
  const promos = Array.isArray(tariff?.promos) ? tariff.promos : [];
  return promos
    .filter((promo) => Number(months) >= Number(promo.min_months || 0))
    .sort((left, right) => Number(right.discount_percent || 0) - Number(left.discount_percent || 0))[0] || null;
}

function paymentFor(tariff, months) {
  const monthCount = Math.max(1, Number(months) || 1);
  const base = Number(tariff?.price || 0) * monthCount;
  const promo = bestPromo(tariff, monthCount);
  const discount = promo ? Math.round((base * Number(promo.discount_percent || 0)) / 100) : 0;
  return {
    base,
    discount,
    promo,
    total: Math.max(0, base - discount),
  };
}

function errorMessage(error, fallback) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return fallback;
  return error?.message || fallback;
}

export function TariffPage() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { t } = useI18n();
  const authShops = useMemo(() => auth.shops || [], [auth.shops]);
  const authSelectedShopId = auth.selectedShop?.shop_id ? String(auth.selectedShop.shop_id) : '';
  const selectAuthShop = auth.selectShop;
  const urlToken = useMemo(() => queryParam(location.search, 'token'), [location.search]);
  const requestedShopId = useMemo(() => queryParam(location.search, 'shop_id'), [location.search]);
  const accessOptions = useMemo(
    () => (urlToken ? { accessToken: urlToken, allowRefresh: false, silentUnauthorized: true } : undefined),
    [urlToken],
  );
  const isTokenMode = Boolean(urlToken);
  const hasAccess = Boolean(urlToken || auth.isLoggedIn);
  const shopLocked = Boolean(urlToken || requestedShopId);
  const phoneInputRef = useRef(null);

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [shopStatus, setShopStatus] = useState('idle');
  const [tariffStatus, setTariffStatus] = useState('idle');
  const [pageError, setPageError] = useState('');
  const [tariffError, setTariffError] = useState('');
  const [tariffs, setTariffs] = useState([]);
  const [currentTariff, setCurrentTariff] = useState(null);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('7');
  const [months, setMonths] = useState(1);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const selectedShop = useMemo(
    () => shops.find((shop) => String(shop.shop_id) === String(selectedShopId)) || null,
    [selectedShopId, shops],
  );
  const selectedShopName = shopLabel(selectedShop) || t('selectedShopFallback');
  const selectedTariff = useMemo(() => {
    const tariff = tariffs.find((item) => String(item.tariff_id) === String(selectedTariffId));
    if (tariff) return tariff;
    return currentTariff && String(currentTariff.tariff_id) === String(selectedTariffId) ? currentTariff : null;
  }, [currentTariff, selectedTariffId, tariffs]);
  const payment = useMemo(() => paymentFor(selectedTariff, months), [months, selectedTariff]);
  const formattedPhone = useMemo(() => formatPhoneDigits(phoneDigits), [phoneDigits]);
  const canSubmit = Boolean(selectedShopId && selectedTariff && phoneIsComplete(phoneDigits) && payment.total > 0);
  const showTariffSelection = !isTokenMode && !currentTariff;

  useEffect(() => {
    if (!hasAccess) return undefined;

    let active = true;
    setShopStatus('loading');
    setPageError('');

    api.tariff
      .getShopPhones(accessOptions)
      .then((data) => {
        if (!active) return;
        const merged = mergeShops(data?.shops, authShops, requestedShopId);
        if (!merged.length) throw new Error(t('noShops'));

        setShops(merged);
        const preferredShopId =
          requestedShopId ||
          (!urlToken && authSelectedShopId ? authSelectedShopId : '') ||
          merged[0].shop_id;
        setSelectedShopId(String(preferredShopId));
        setShopStatus('ready');

        if (!urlToken && requestedShopId && authSelectedShopId !== String(requestedShopId)) {
          selectAuthShop(requestedShopId);
        }
      })
      .catch((error) => {
        if (!active) return;
        const fallbackShops = !urlToken ? mergeShops([], authShops, requestedShopId) : [];
        if (fallbackShops.length) {
          setShops(fallbackShops);
          setSelectedShopId(
            String(requestedShopId || authSelectedShopId || fallbackShops[0].shop_id),
          );
          setShopStatus('ready');
          return;
        }

        setShopStatus('error');
        setPageError(errorMessage(error, t('tariffShopLoadError')));
      });

    return () => {
      active = false;
    };
  }, [accessOptions, authSelectedShopId, authShops, hasAccess, requestedShopId, selectAuthShop, t, urlToken]);

  useEffect(() => {
    if (!hasAccess || !selectedShopId) return undefined;

    let active = true;
    setTariffStatus('loading');
    setTariffError('');
    setTariffs([]);
    setCurrentTariff(null);
    setSelectedTariffId('');

    api.tariff
      .getAvailable(selectedShopId, accessOptions)
      .then((data) => {
        if (!active) return;
        const available = Array.isArray(data?.tariffs) ? data.tariffs : [];
        const current = enrichCurrentTariff(data?.current_tariff, available);
        const defaultTariff = current || available[0] || null;

        setTariffs(available);
        setCurrentTariff(current);
        setSelectedTariffId(defaultTariff ? String(defaultTariff.tariff_id) : '');
        setTariffStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setTariffStatus('error');
        setTariffError(errorMessage(error, t('tariffLoadError')));
      });

    return () => {
      active = false;
    };
  }, [accessOptions, hasAccess, reloadTick, requestedShopId, selectedShopId, t, urlToken]);

  useEffect(() => {
    if (selectedShop?.phone) {
      setPhoneDigits(normalizePhoneDigits(selectedShop.phone));
      return;
    }
    setPhoneDigits('7');
  }, [selectedShop?.phone, selectedShopId]);

  if (!hasAccess) return null;

  const setMonthValue = (value) => {
    setMonths(Math.min(36, Math.max(1, Number(value) || 1)));
  };

  const changeShop = (shopId) => {
    setSelectedShopId(shopId);
    if (!urlToken) selectAuthShop(shopId);
  };

  const placePhoneCaret = (index) => {
    window.requestAnimationFrame(() => {
      const input = phoneInputRef.current;
      if (!input) return;
      const caret = Math.min(index, input.value.length);
      input.setSelectionRange(caret, caret);
    });
  };

  const removeDigitNearFormatting = (targetIndex) => {
    const positions = digitPositions(phoneDigits);
    const nextDigit = positions.find((position) => position.index > targetIndex && position.digitIndex > 0);
    const previousDigit = [...positions]
      .reverse()
      .find((position) => position.index < targetIndex && position.digitIndex > 0);
    const digit = nextDigit || previousDigit;
    if (!digit) return false;

    const nextDigits = removeDigitAt(phoneDigits, digit.digitIndex);
    setPhoneDigits(nextDigits);
    placePhoneCaret(targetIndex);
    return true;
  };

  const handlePhoneKeyDown = (event) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return;

    const targetIndex = event.key === 'Backspace' ? Number(input.selectionStart) - 1 : Number(input.selectionStart);
    if (targetIndex < 0 || /\d/.test(input.value[targetIndex] || '')) return;

    if (removeDigitNearFormatting(targetIndex)) event.preventDefault();
  };

  const handlePhoneChange = (event) => {
    const nextDigits = normalizePhoneDigits(event.target.value);
    const inputType = event.nativeEvent?.inputType || '';

    if (inputType.startsWith('delete') && nextDigits === phoneDigits) {
      const targetIndex = inputType === 'deleteContentBackward'
        ? Number(event.target.selectionStart) - 1
        : Number(event.target.selectionStart);
      if (removeDigitNearFormatting(Math.max(0, targetIndex))) return;
    }

    setPhoneDigits(nextDigits);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedShopId) {
      toast.error(t('remotePayNoShop'));
      return;
    }
    if (!selectedTariff) {
      toast.error(t('tariffSelectRequired'));
      return;
    }
    if (!phoneIsComplete(phoneDigits)) {
      toast.error(t('remotePayPhoneError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.tariff.remotePayRequest(
        {
          phone: formatPhoneDigits(phoneDigits),
          amount: payment.total,
          comment: comment.trim() || undefined,
          shop_id: String(selectedShopId),
          tariff_id: Number(selectedTariff.tariff_id),
          months: Number(months),
        },
        accessOptions,
      );
      if (result?.status === 'error') throw new Error(result.error_text || t('remotePaySendError'));
      toast.success(t('remotePaySent'));
      setComment('');
    } catch (error) {
      toast.error(t('remotePaySendErrorWithMessage', { message: errorMessage(error, t('remotePaySendError')) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className={`fade-in tariff-page ${isTokenMode ? 'tariff-page-token' : ''}`}>
      {!isTokenMode ? (
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('tariffTitle')}</h1>
            <p className="page-subtitle">{t('tariffSubtitle')}</p>
          </div>
        </div>
      ) : null}

      {!isTokenMode && pageError ? (
        <div className="card warning-card mb-6">
          <div className="card-title mb-4">{t('error')}</div>
          <p className="color-muted">{pageError}</p>
        </div>
      ) : null}

      <div className={`tariff-layout ${isTokenMode ? 'tariff-layout-token' : ''}`}>
        {!isTokenMode ? (
          <section className="tariff-main">
          <div className="card mb-6">
            <div className="card-header">
              <div>
                <div className="card-title">{t('tariffShopTitle')}</div>
                <div className="card-subtitle">{t('tariffShopSubtitle')}</div>
              </div>
              {shopStatus === 'loading' ? <span className="badge badge-info">{t('loading')}</span> : null}
            </div>

            {shopLocked ? (
              <div className="input-group mb-0">
                <label>{t('shop')}</label>
                <input value={selectedShopName} readOnly />
              </div>
            ) : (
              <div className="input-group mb-0">
                <label htmlFor="tariff-shop">{t('shop')}</label>
                <select
                  id="tariff-shop"
                  value={selectedShopId}
                  disabled={shopStatus === 'loading' || !shops.length}
                  onChange={(event) => changeShop(event.target.value)}
                >
                  {shops.map((shop) => (
                    <option value={shop.shop_id} key={shop.shop_id}>
                      {shopLabel(shop) || t('selectedShopFallback')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {tariffError ? (
            <div className="card warning-card mb-6">
              <div className="card-title mb-4">{t('tariffUnavailableTitle')}</div>
              <p className="color-muted mb-4">{tariffError}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setReloadTick((value) => value + 1)}>
                <RefreshCw size={15} />
                {t('refresh')}
              </button>
            </div>
          ) : null}

          {tariffStatus === 'loading' ? (
            <div className="card tariff-loading">
              <div className="spinner-ring" />
              <p>{t('tariffLoading')}</p>
            </div>
          ) : null}

          {tariffStatus === 'ready' && currentTariff ? (
            <div className="card current-tariff-card mb-6">
              <div>
                <span className="badge badge-success">{t('currentTariff')}</span>
                <h2>{currentTariff.tariff_name}</h2>
                <p>{t('currentTariffValidUntil', { date: fmtDate(currentTariff.valid_until) })}</p>
              </div>
              <div className="current-tariff-price">{fmt(currentTariff.price)}</div>
            </div>
          ) : null}

          {tariffStatus === 'ready' && showTariffSelection ? (
            tariffs.length ? (
              <div className="tariff-grid">
                {tariffs.map((tariff) => {
                  const selected = String(tariff.tariff_id) === String(selectedTariffId);
                  return (
                    <button
                      className={`tariff-card ${selected ? 'selected' : ''}`}
                      key={tariff.tariff_id}
                      type="button"
                      onClick={() => setSelectedTariffId(String(tariff.tariff_id))}
                    >
                      <div className="tariff-card-top">
                        <div>
                          <h3>{tariff.tariff_name}</h3>
                          <p>{t('tariffMonthlyPrice')}</p>
                        </div>
                        {selected ? <Check size={20} /> : <CreditCard size={20} />}
                      </div>
                      <div className="tariff-price">{fmt(tariff.price)}</div>
                      {Array.isArray(tariff.promos) && tariff.promos.length ? (
                        <div className="promo-list">
                          {tariff.promos.map((promo) => (
                            <span className="promo-chip" key={`${tariff.tariff_id}-${promo.min_months}`}>
                              <Sparkles size={13} />
                              {t('tariffPromoPreview', {
                                months: promo.min_months,
                                percent: promo.discount_percent,
                              })}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm color-muted">{t('tariffNoPromo')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state card">
                <CreditCard size={40} />
                <h3>{t('tariffNoAvailableTitle')}</h3>
                <p>{t('tariffNoAvailableText')}</p>
              </div>
            )
          ) : null}

        </section>
        ) : null}

        <aside className="card tariff-pay-card">
          <div className="card-header">
            <div>
              <div className="card-title">{isTokenMode ? t('tariffTitle') : t('tariffPayTitle')}</div>
              <div className="card-subtitle">{selectedTariff ? selectedTariff.tariff_name : t('tariffSelectRequired')}</div>
            </div>
          </div>
          <p className="tariff-payment-hint">{t('tariffPaymentHint')}</p>

          <form className="tariff-pay-form" onSubmit={submit}>
            <div className="tariff-payment-summary">
              <div>
                <span>{t('shop')}</span>
                <strong>{selectedShopName}</strong>
              </div>
              <div>
                <span>{currentTariff ? t('currentTariff') : t('navTariff')}</span>
                <strong>{selectedTariff?.tariff_name || t('tariffSelectRequired')}</strong>
              </div>
              {currentTariff?.valid_until ? (
                <p>{t('currentTariffValidUntil', { date: fmtDate(currentTariff.valid_until) })}</p>
              ) : null}
            </div>

            {isTokenMode && pageError ? (
              <div className="tariff-inline-warning">
                <strong>{t('error')}</strong>
                <span>{pageError}</span>
              </div>
            ) : null}

            {isTokenMode && tariffError ? (
              <div className="tariff-inline-warning">
                <strong>{t('tariffUnavailableTitle')}</strong>
                <span>{tariffError}</span>
              </div>
            ) : null}

            {isTokenMode && tariffStatus === 'loading' ? (
              <div className="tariff-inline-loading">
                <div className="spinner-ring" />
                <span>{t('tariffLoading')}</span>
              </div>
            ) : null}

            <div className="input-group">
              <label htmlFor="tariff-phone">{t('remoteCheckPhone')}</label>
              <input
                id="tariff-phone"
                ref={phoneInputRef}
                inputMode="tel"
                autoComplete="tel"
                value={formattedPhone}
                placeholder="+7 (778) 879-66-33"
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
              />
            </div>

            <div className="input-group">
              <label htmlFor="tariff-months">{t('tariffMonths')}</label>
              <div className="months-control">
                <button type="button" onClick={() => setMonthValue(months - 1)}>-</button>
                <input
                  id="tariff-months"
                  min="1"
                  max="36"
                  inputMode="numeric"
                  type="number"
                  value={months}
                  onChange={(event) => setMonthValue(event.target.value)}
                />
                <button type="button" onClick={() => setMonthValue(months + 1)}>+</button>
              </div>
              <div className="month-presets">
                {MONTH_PRESETS.map((value) => (
                  <button
                    className={Number(months) === value ? 'active' : ''}
                    key={value}
                    type="button"
                    onClick={() => setMonthValue(value)}
                  >
                    {t('monthsShort', { count: value })}
                  </button>
                ))}
              </div>
            </div>

            <div className="tariff-total">
              <div>
                <span>{t('tariffBaseAmount')}</span>
                <strong>{fmt(payment.base)}</strong>
              </div>
              <div>
                <span>{t('tariffDiscount')}</span>
                <strong className={payment.discount ? 'color-green' : ''}>
                  {payment.discount ? `-${fmt(payment.discount)}` : fmt(0)}
                </strong>
              </div>
              <div className="tariff-total-final">
                <span>{t('amount')}</span>
                <strong>{fmt(payment.total)}</strong>
              </div>
              {payment.promo ? (
                <p>{t('tariffPromoApplied', { percent: payment.promo.discount_percent })}</p>
              ) : null}
            </div>

            <div className="input-group">
              <label htmlFor="tariff-comment">{t('commentOptional')}</label>
              <textarea
                id="tariff-comment"
                rows="4"
                maxLength="240"
                value={comment}
                placeholder={t('tariffCommentPlaceholder')}
                onChange={(event) => setComment(event.target.value)}
              />
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={!canSubmit || isSubmitting}>
              <Send size={16} />
              {isSubmitting ? t('remotePaySending') : t('remotePaySubmit')}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );

  return content;
}
