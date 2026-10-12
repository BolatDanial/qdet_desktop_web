import { Check, ChevronDown, Clock, Coins, CreditCard, RefreshCw, Send, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fmt, fmtDate, fmtDateTime } from '../utils/format.js';
import {
  finishRemotePayRecord,
  prepareRemotePayIdempotency,
  readLastPhoneUsed,
  saveRemotePayRecord,
  syncRemotePayIdempotency,
  writeLastPhoneUsed,
} from '../utils/remotePayIdempotency.js';

const MONTH_PRESETS = [1, 3, 6, 12];
const BONUS_MAX_SHARE = 0.5;
const TARIFF_INVOICE_MODAL_ID = 'tariff-invoice-modal';

function currentFeaturePriceMap(currentTariff) {
  const features = Array.isArray(currentTariff?.features) ? currentTariff.features : [];
  const prices = new Map();
  features.forEach((feature) => {
    const id = Number(feature?.feature_id);
    if (!Number.isFinite(id)) return;
    prices.set(id, Number(feature.price) || 0);
  });
  return prices;
}

function paidFeaturesFrom(features, currentTariff) {
  const currentPrices = currentFeaturePriceMap(currentTariff);
  return (Array.isArray(features) ? features : [])
    .filter((feature) => Number(feature?.price) > 0)
    .map((feature) => {
      const featureId = Number(feature.feature_id);
      const owned = currentPrices.has(featureId);
      return {
        feature_id: featureId,
        feature_name: feature.feature_name || '',
        price: owned ? currentPrices.get(featureId) : Number(feature.price) || 0,
        owned,
      };
    });
}

function selectedFeaturesPayload(paidFeatures, selectedFeatureIds) {
  return paidFeatures
    .filter((feature) => selectedFeatureIds.has(feature.feature_id))
    .map((feature) => ({
      feature_id: feature.feature_id,
      price: feature.price,
    }));
}

function featuresCostFor(paidFeatures, selectedFeatureIds, months) {
  const monthCount = Math.max(1, Number(months) || 1);
  const monthly = paidFeatures
    .filter((feature) => selectedFeatureIds.has(feature.feature_id))
    .reduce((sum, feature) => sum + Number(feature.price || 0), 0);
  return monthly * monthCount;
}

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

function promoDiscount(promo, tariff, months) {
  const amount = Number(promo?.discount_amount);
  if (promo?.discount_amount !== undefined && promo?.discount_amount !== null && Number.isFinite(amount)) {
    return Math.max(0, amount) * months;
  }
  const base = Number(tariff?.price || 0) * months;
  return Math.round((base * Number(promo?.discount_percent || 0)) / 100);
}

function bestPromo(tariff, months) {
  const promos = Array.isArray(tariff?.promos) ? tariff.promos : [];
  return promos
    .filter((promo) => Number(months) >= Number(promo.min_months || 0))
    .sort((left, right) => promoDiscount(right, tariff, months) - promoDiscount(left, tariff, months))[0] || null;
}

function paymentFor(tariff, months) {
  const monthCount = Math.max(1, Number(months) || 1);
  const base = Number(tariff?.price || 0) * monthCount;
  const promo = bestPromo(tariff, monthCount);
  const discount = promo ? promoDiscount(promo, tariff, monthCount) : 0;
  return {
    base,
    discount,
    promo,
    total: Math.max(0, base - discount),
  };
}

function maxBonusesForAmount(amount) {
  return Math.floor(Math.max(0, Number(amount) || 0) * BONUS_MAX_SHARE);
}

function appliedBonuses(amount, balance, useBonuses) {
  if (!useBonuses) return 0;
  const total = Math.max(0, Number(amount) || 0);
  const available = Math.max(0, Number(balance) || 0);
  if (!total || !available) return 0;
  return Math.min(available, maxBonusesForAmount(total));
}

function errorMessage(error, fallback) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return fallback;
  return error?.message || fallback;
}

function errorDetail(error) {
  if (!error || typeof error !== 'object') return null;
  if (error.data?.detail !== undefined) return error.data.detail;
  if (error.detail !== undefined) return error.detail;
  return null;
}

function errorDetailText(error) {
  const detail = errorDetail(error) ?? error?.message ?? '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || item?.detail || String(item)).join(' ');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || detail.detail || JSON.stringify(detail);
  }
  return String(detail);
}

function errorDetailCode(error) {
  const detail = errorDetail(error);
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.code) {
    return String(detail.code);
  }
  if (error?.data?.code) return String(error.data.code);
  if (error?.code) return String(error.code);
  return '';
}

function isPendingInvoiceConflict(error) {
  if (!(error instanceof ApiError) || error.status !== 400) return false;
  return /already has pending invoice/i.test(errorDetailText(error));
}

function isKaspiClientNotFound(error) {
  if (errorDetailCode(error) === 'kaspi_client_not_found') return true;
  return /kaspi_client_not_found/i.test(errorDetailText(error));
}

function invoiceCancelErrorMessage(error, t) {
  if (!(error instanceof ApiError)) return errorMessage(error, t('tariffInvoiceCancelError'));
  if (error.status === 403) return t('tariffInvoiceShopMismatch');
  if (error.status === 404) return t('tariffInvoiceNotFound');
  if (error.status === 409) return t('tariffInvoiceNotPending');
  if (error.status === 422) return t('tariffInvoiceCancelError');
  return error.message || t('tariffInvoiceCancelError');
}

function pendingInvoiceId(invoice) {
  const raw = invoice?.invoice_id ?? invoice?.id ?? invoice?.invoiceId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function PendingInvoiceCard({ invoice, isCancelling, onCancel, t }) {
  if (!invoice) return null;

  return (
    <div className="card tariff-pending-invoice mb-6">
      <div className="tariff-pending-invoice-header">
        <div className="tariff-pending-invoice-title">
          <span className="tariff-pending-icon">
            <Clock size={18} />
          </span>
          <div>
            <div className="card-title">{t('tariffPendingInvoiceTitle')}</div>
            <p className="tariff-pending-subtitle">{t('tariffPendingInvoiceSubtitle')}</p>
          </div>
        </div>
        <span className="badge badge-warning">{t('tariffInvoiceStatusPending')}</span>
      </div>

      <div className="tariff-pending-details">
        <div className="tariff-pending-row">
          <div>
            <span>{t('navTariff')}</span>
            <strong>{invoice.tariff_name}</strong>
          </div>
          <div>
            <span>{t('tariffMonthShort')}</span>
            <strong>{t('monthsShort', { count: invoice.months })}</strong>
          </div>
        </div>
        <div className="tariff-pending-row">
          <div>
            <span>{t('shop')}</span>
            <strong>{invoice.shop_name || t('selectedShopFallback')}</strong>
          </div>
          <div>
            <span>{t('amount')}</span>
            <strong className="tariff-pending-detail-amount">{fmt(invoice.amount)}</strong>
          </div>
        </div>
        <div className="tariff-pending-row tariff-pending-row-full">
          <div>
            <span>{t('phone')}</span>
            <strong>{invoice.phone || '—'}</strong>
          </div>
        </div>
        {invoice.comment ? (
          <div className="tariff-pending-row tariff-pending-row-full">
            <div>
              <span>{t('comment')}</span>
              <strong>{invoice.comment}</strong>
            </div>
          </div>
        ) : null}
        {Number(invoice.bonuses) > 0 ? (
          <div className="tariff-pending-row tariff-pending-row-full">
            <div>
              <span>{t('tariffInvoiceBonuses')}</span>
              <strong className="color-green">{fmt(invoice.bonuses)}</strong>
            </div>
          </div>
        ) : null}
      </div>

      <p className="tariff-pending-created">{t('tariffInvoiceCreatedAt', { date: fmtDateTime(invoice.created_at) })}</p>

      <button
        className="btn btn-ghost btn-full tariff-pending-cancel"
        type="button"
        disabled={isCancelling}
        onClick={() => onCancel(invoice)}
      >
        <XCircle size={16} />
        {isCancelling ? t('tariffInvoiceCancelling') : t('tariffInvoiceCancel')}
      </button>
    </div>
  );
}

export function TariffPage() {
  const auth = useAuth();
  const toast = useToast();
  const modal = useModal();
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
  const shopLoadAuthRef = useRef({
    shops: authShops,
    selectedShopId: authSelectedShopId,
    selectShop: selectAuthShop,
    t,
  });
  shopLoadAuthRef.current = {
    shops: authShops,
    selectedShopId: authSelectedShopId,
    selectShop: selectAuthShop,
    t,
  };

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [shopStatus, setShopStatus] = useState('idle');
  const [tariffStatus, setTariffStatus] = useState('idle');
  const [pageError, setPageError] = useState('');
  const [tariffError, setTariffError] = useState('');
  const [tariffs, setTariffs] = useState([]);
  const [currentTariff, setCurrentTariff] = useState(null);
  const [paidFeatures, setPaidFeatures] = useState([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState(() => new Set());
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [phoneDigits, setPhoneDigits] = useState(() => normalizePhoneDigits(readLastPhoneUsed() || '7'));
  const [months, setMonths] = useState(1);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [invoiceStatus, setInvoiceStatus] = useState('idle');
  const [isCancellingInvoice, setIsCancellingInvoice] = useState(false);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [bonusStatus, setBonusStatus] = useState('idle');
  const [useBonuses, setUseBonuses] = useState(false);
  const [kaspiClientNotFound, setKaspiClientNotFound] = useState(false);

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
  const featuresCost = useMemo(
    () => featuresCostFor(paidFeatures, selectedFeatureIds, months),
    [months, paidFeatures, selectedFeatureIds],
  );
  const selectedFeatures = useMemo(
    () => selectedFeaturesPayload(paidFeatures, selectedFeatureIds),
    [paidFeatures, selectedFeatureIds],
  );
  const amountTotal = useMemo(
    () => Math.max(0, payment.total + featuresCost),
    [featuresCost, payment.total],
  );
  const bonusesToApply = useMemo(
    () => appliedBonuses(amountTotal, bonusBalance, useBonuses),
    [amountTotal, bonusBalance, useBonuses],
  );
  const payableTotal = useMemo(
    () => Math.max(0, amountTotal - bonusesToApply),
    [amountTotal, bonusesToApply],
  );
  const canUseBonuses = bonusBalance > 0 && amountTotal > 0 && maxBonusesForAmount(amountTotal) > 0;
  const remotePayFormPhone = useMemo(() => formatPhoneDigits(phoneDigits), [phoneDigits]);
  const canSubmit = Boolean(selectedShopId && selectedTariff && phoneIsComplete(phoneDigits) && amountTotal > 0);
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
        const { shops: currentAuthShops, selectedShopId: currentAuthShopId, selectShop, t: translate } =
          shopLoadAuthRef.current;
        const merged = mergeShops(data?.shops, currentAuthShops, requestedShopId);
        if (!merged.length) throw new Error(translate('noShops'));

        setShops(merged);
        const preferredShopId =
          requestedShopId ||
          (!urlToken && currentAuthShopId ? currentAuthShopId : '') ||
          merged[0].shop_id;
        setSelectedShopId(String(preferredShopId));
        setShopStatus('ready');

        if (!urlToken && requestedShopId && currentAuthShopId !== String(requestedShopId)) {
          selectShop(requestedShopId);
        }
      })
      .catch((error) => {
        if (!active) return;
        const { shops: currentAuthShops, selectedShopId: currentAuthShopId, t: translate } =
          shopLoadAuthRef.current;
        const fallbackShops = !urlToken ? mergeShops([], currentAuthShops, requestedShopId) : [];
        if (fallbackShops.length) {
          setShops(fallbackShops);
          setSelectedShopId(
            String(requestedShopId || currentAuthShopId || fallbackShops[0].shop_id),
          );
          setShopStatus('ready');
          return;
        }

        setShopStatus('error');
        setPageError(errorMessage(error, translate('tariffShopLoadError')));
      });

    return () => {
      active = false;
    };
  }, [accessOptions, hasAccess, requestedShopId, urlToken]);

  useEffect(() => {
    if (!hasAccess || !selectedShopId) return undefined;

    let active = true;
    setTariffStatus('loading');
    setTariffError('');
    setTariffs([]);
    setCurrentTariff(null);
    setPaidFeatures([]);
    setSelectedFeatureIds(new Set());
    setFeaturesOpen(false);
    setSelectedTariffId('');

    api.tariff
      .getAvailable(selectedShopId, accessOptions)
      .then((data) => {
        if (!active) return;
        const available = Array.isArray(data?.tariffs) ? data.tariffs : [];
        const current = enrichCurrentTariff(data?.current_tariff, available);
        const defaultTariff = current || available[0] || null;
        const nextPaidFeatures = paidFeaturesFrom(data?.features, current);
        const preselected = new Set(
          nextPaidFeatures
            .filter((feature) => feature.owned)
            .map((feature) => feature.feature_id),
        );

        setTariffs(available);
        setCurrentTariff(current);
        setPaidFeatures(nextPaidFeatures);
        setSelectedFeatureIds(preselected);
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
    if (!hasAccess || !selectedShopId) return undefined;

    let active = true;
    setInvoiceStatus('loading');
    setPendingInvoice(null);

    api.tariff
      .getPendingInvoice(selectedShopId, accessOptions)
      .then((data) => {
        if (!active) return;
        const invoice = data?.invoice || null;
        setPendingInvoice(invoice);
        setInvoiceStatus('ready');
        syncRemotePayIdempotency(selectedShopId, invoice);
      })
      .catch((error) => {
        if (!active) return;
        setInvoiceStatus('error');
        setPendingInvoice(null);
        if (!isTokenMode) {
          toast.error(errorMessage(error, t('tariffInvoiceLoadError')));
        }
      });

    return () => {
      active = false;
    };
  }, [accessOptions, hasAccess, isTokenMode, reloadTick, selectedShopId, t, toast]);

  useEffect(() => {
    if (!hasAccess || !selectedShopId) return undefined;

    let active = true;
    setBonusStatus('loading');
    setBonusBalance(0);
    setUseBonuses(false);

    api.tariff
      .getBonusBalance(selectedShopId, accessOptions)
      .then((data) => {
        if (!active) return;
        setBonusBalance(Math.max(0, Number(data?.balance) || 0));
        setBonusStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setBonusBalance(0);
        setBonusStatus('error');
      });

    return () => {
      active = false;
    };
  }, [accessOptions, hasAccess, reloadTick, selectedShopId]);

  useEffect(() => {
    setKaspiClientNotFound(false);
  }, [phoneDigits]);

  useEffect(() => {
    if (!useBonuses || canUseBonuses) return;
    setUseBonuses(false);
  }, [canUseBonuses, useBonuses]);

  useEffect(() => {
    const lastPhone = readLastPhoneUsed();
    if (lastPhone) {
      setPhoneDigits(normalizePhoneDigits(lastPhone));
      return;
    }
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

  const toggleFeature = (featureId) => {
    setSelectedFeatureIds((current) => {
      const next = new Set(current);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
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

  const refreshPendingInvoice = async () => {
    if (!selectedShopId) return null;
    try {
      const data = await api.tariff.getPendingInvoice(selectedShopId, accessOptions);
      const invoice = data?.invoice || null;
      setPendingInvoice(invoice);
      setInvoiceStatus('ready');
      syncRemotePayIdempotency(selectedShopId, invoice);
      return invoice;
    } catch {
      setPendingInvoice(null);
      setInvoiceStatus('error');
      syncRemotePayIdempotency(selectedShopId, null);
      return null;
    }
  };

  const confirmCancelInvoice = (invoice) => {
    const target = pendingInvoiceId(invoice) ? invoice : pendingInvoice;
    if (!target) return;

    modal.open({
      id: TARIFF_INVOICE_MODAL_ID,
      title: t('tariffInvoiceCancelConfirmTitle'),
      body: <p className="color-muted">{t('tariffInvoiceCancelConfirmText')}</p>,
      footer: (
        <>
          <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>
            {t('cancel')}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              modal.closeAll();
              cancelInvoice(target);
            }}
          >
            {t('tariffInvoiceCancel')}
          </button>
        </>
      ),
    });
  };

  const showPendingInvoiceBlockedDialog = (invoice = pendingInvoice) => {
    const target = pendingInvoiceId(invoice) ? invoice : pendingInvoice;
    modal.open({
      id: TARIFF_INVOICE_MODAL_ID,
      title: t('tariffPendingInvoiceBlockedTitle'),
      body: <p className="color-muted">{t('tariffPendingInvoiceBlockedText')}</p>,
      footer: (
        <>
          <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>
            {t('close')}
          </button>
          {target ? (
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => confirmCancelInvoice(target)}
            >
              {t('tariffInvoiceCancel')}
            </button>
          ) : null}
        </>
      ),
    });
  };

  const showKaspiClientNotFound = () => {
    setKaspiClientNotFound(true);
    modal.open({
      id: TARIFF_INVOICE_MODAL_ID,
      closeOnOverlay: false,
      title: t('remotePayKaspiClientNotFoundTitle'),
      body: <p className="color-muted">{t('remotePayKaspiClientNotFoundText')}</p>,
      footer: (
        <button className="btn btn-primary" type="button" onClick={modal.closeAll}>
          {t('close')}
        </button>
      ),
    });
  };

  const cancelInvoice = async (invoice) => {
    const target = pendingInvoiceId(invoice) ? invoice : pendingInvoice;
    if (!target || !selectedShopId) return;

    const invoiceId = pendingInvoiceId(target);
    if (!invoiceId) {
      toast.error(t('tariffInvoiceCancelError'));
      return;
    }

    modal.closeAll();
    setIsCancellingInvoice(true);
    try {
      const result = await api.tariff.cancelInvoice(
        {
          shop_id: String(selectedShopId),
          invoice_id: invoiceId,
        },
        accessOptions,
      );
      if (result?.status === 'error') {
        throw new Error(result.error_text || t('tariffInvoiceCancelError'));
      }
      finishRemotePayRecord(selectedShopId);
      setPendingInvoice(null);
      toast.success(t('tariffInvoiceCancelSuccess'));
      await refreshPendingInvoice();
    } catch (error) {
      toast.error(
        t('tariffInvoiceCancelErrorWithMessage', {
          message: invoiceCancelErrorMessage(error, t),
        }),
      );
      await refreshPendingInvoice();
    } finally {
      setIsCancellingInvoice(false);
    }
  };

  const sendRemotePay = async () => {
    if (!selectedShopId || !selectedTariff || !phoneIsComplete(phoneDigits)) return;
    if (pendingInvoice) {
      showPendingInvoiceBlockedDialog(pendingInvoice);
      return;
    }

    const formatted = remotePayFormPhone;
    setKaspiClientNotFound(false);
    setIsSubmitting(true);
    try {
      const bonuses = appliedBonuses(amountTotal, bonusBalance, useBonuses);
      const paymentRequest = {
        phone: formatted,
        amount: amountTotal,
        bonuses,
        comment: comment.trim() || undefined,
        shop_id: String(selectedShopId),
        tariff_id: Number(selectedTariff.tariff_id),
        months: Number(months),
        features: selectedFeatures,
      };
      const { idempotencyKey } = prepareRemotePayIdempotency(selectedShopId, paymentRequest);
      const result = await api.tariff.remotePayRequest(paymentRequest, {
        ...accessOptions,
        idempotencyKey,
      });
      if (isKaspiClientNotFound(result)) {
        throw new ApiError(result.detail || result, { data: result });
      }
      if (result?.status === 'error') throw new Error(result.error_text || t('remotePaySendError'));
      writeLastPhoneUsed(formatted);
      saveRemotePayRecord(selectedShopId, {
        idempotencyKey,
        paymentRequest,
      });
      toast.success(t('remotePaySent'));
      setComment('');
      setUseBonuses(false);
      await refreshPendingInvoice();
      try {
        const bonusData = await api.tariff.getBonusBalance(selectedShopId, accessOptions);
        setBonusBalance(Math.max(0, Number(bonusData?.balance) || 0));
        setBonusStatus('ready');
      } catch {
        setBonusStatus('error');
      }
    } catch (error) {
      if (isPendingInvoiceConflict(error)) {
        const invoice = await refreshPendingInvoice();
        showPendingInvoiceBlockedDialog(invoice);
        return;
      }
      if (isKaspiClientNotFound(error)) {
        finishRemotePayRecord(selectedShopId);
        showKaspiClientNotFound();
        await refreshPendingInvoice();
        return;
      }
      toast.error(t('remotePaySendErrorWithMessage', { message: errorMessage(error, t('remotePaySendError')) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSendRemotePay = () => {
    modal.open({
      id: TARIFF_INVOICE_MODAL_ID,
      closeOnOverlay: false,
      footerAlign: 'start',
      title: t('remotePayKaspiPhoneConfirmTitle'),
      body: <p className="color-muted">{t('remotePayKaspiPhoneConfirmText')}</p>,
      footer: (
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            modal.closeAll();
            sendRemotePay();
          }}
        >
          {t('remotePaySubmit')}
        </button>
      ),
    });
  };

  const submit = (event) => {
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

    if (pendingInvoice) {
      showPendingInvoiceBlockedDialog(pendingInvoice);
      return;
    }

    confirmSendRemotePay();
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

          {invoiceStatus === 'loading' ? (
            <div className="card tariff-invoice-loading mb-6">
              <div className="spinner-ring" />
              <span>{t('loading')}</span>
            </div>
          ) : null}

          {invoiceStatus === 'ready' && pendingInvoice ? (
            <PendingInvoiceCard
              key={pendingInvoiceId(pendingInvoice) || pendingInvoice.created_at || 'pending'}
              invoice={pendingInvoice}
              isCancelling={isCancellingInvoice}
              onCancel={confirmCancelInvoice}
              t={t}
            />
          ) : null}

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
                              {promo.discount_amount !== undefined && promo.discount_amount !== null
                                ? t('tariffPromoPreviewAmount', {
                                    months: promo.min_months,
                                    amount: fmt(promo.discount_amount),
                                  })
                                : t('tariffPromoPreview', {
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

          {isTokenMode && invoiceStatus === 'loading' ? (
            <div className="tariff-inline-loading">
              <div className="spinner-ring" />
              <span>{t('loading')}</span>
            </div>
          ) : null}

          {isTokenMode && invoiceStatus === 'ready' && pendingInvoice ? (
            <PendingInvoiceCard
              key={pendingInvoiceId(pendingInvoice) || pendingInvoice.created_at || 'pending-token'}
              invoice={pendingInvoice}
              isCancelling={isCancellingInvoice}
              onCancel={confirmCancelInvoice}
              t={t}
            />
          ) : null}

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

            {paidFeatures.length ? (
              <div className={`tariff-features ${featuresOpen ? 'open' : ''}`}>
                <button
                  className="tariff-features-toggle"
                  type="button"
                  aria-expanded={featuresOpen}
                  onClick={() => setFeaturesOpen((value) => !value)}
                >
                  <span className="tariff-features-toggle-label">
                    <ChevronDown size={16} className="tariff-features-chevron" />
                    {t('tariffAdditionalFeatures')}
                  </span>
                  <strong>
                    {selectedFeatures.length
                      ? t('tariffAdditionalFeaturesSelected', { count: selectedFeatures.length })
                      : t('tariffAdditionalFeaturesNone')}
                  </strong>
                </button>

                {featuresOpen ? (
                  <div className="tariff-features-list">
                    {paidFeatures.map((feature) => {
                      const checked = selectedFeatureIds.has(feature.feature_id);
                      return (
                        <label className="tariff-feature-row" key={feature.feature_id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeature(feature.feature_id)}
                          />
                          <span className="tariff-feature-copy">
                            <span className="tariff-feature-name">{feature.feature_name}</span>
                            {feature.owned ? (
                              <span className="tariff-feature-owned">{t('tariffFeatureOwned')}</span>
                            ) : null}
                          </span>
                          <strong>{fmt(feature.price)}</strong>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

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
                value={remotePayFormPhone}
                placeholder="+7 (778) 879-66-33"
                aria-invalid={kaspiClientNotFound}
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
              />
              {kaspiClientNotFound ? (
                <p className="color-red text-sm" role="alert">
                  {t('remotePayKaspiClientNotFoundText')}
                </p>
              ) : null}
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
              {paidFeatures.length ? (
                <div>
                  <span>{t('tariffAdditionalFeaturesCost')}</span>
                  <strong>{fmt(featuresCost)}</strong>
                </div>
              ) : null}
              <div className="tariff-total-final">
                <span>{t('amount')}</span>
                <strong>{fmt(amountTotal)}</strong>
              </div>
              {payment.promo ? (
                <p>
                  {payment.promo.discount_amount !== undefined && payment.promo.discount_amount !== null
                    ? t('tariffPromoAppliedAmount', { amount: fmt(payment.promo.discount_amount) })
                    : t('tariffPromoApplied', { percent: payment.promo.discount_percent })}
                </p>
              ) : null}
            </div>

            <div className="tariff-bonus-section">
              <div className="tariff-bonus-balance">
                <span className="tariff-bonus-balance-label">
                  <Coins size={15} />
                  {t('tariffBonusBalance')}
                </span>
                <strong>{bonusStatus === 'loading' ? '…' : fmt(bonusBalance)}</strong>
              </div>

              <label className={`tariff-bonus-toggle ${!canUseBonuses ? 'disabled' : ''}`}>
                <span>{t('tariffUseBonuses')}</span>
                <input
                  type="checkbox"
                  checked={useBonuses && canUseBonuses}
                  disabled={!canUseBonuses || bonusStatus === 'loading'}
                  onChange={(event) => setUseBonuses(event.target.checked)}
                />
                <span className="tariff-bonus-switch" aria-hidden="true" />
              </label>

              {canUseBonuses ? (
                <p className="tariff-bonus-hint">{t('tariffBonusMaxHint', { percent: 50 })}</p>
              ) : bonusStatus === 'ready' ? (
                <p className="tariff-bonus-hint">{t('tariffBonusUnavailable')}</p>
              ) : null}

              {useBonuses && bonusesToApply > 0 ? (
                <div className="tariff-bonus-breakdown">
                  <div>
                    <span>{t('amount')}</span>
                    <strong>{fmt(amountTotal)}</strong>
                  </div>
                  <div>
                    <span>{t('tariffBonusesApplied')}</span>
                    <strong className="color-green">-{fmt(bonusesToApply)}</strong>
                  </div>
                  <div className="tariff-bonus-payable">
                    <span>{t('tariffTotalWithBonuses')}</span>
                    <strong>{fmt(payableTotal)}</strong>
                  </div>
                </div>
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
