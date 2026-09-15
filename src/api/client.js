import { hasFullSessionAccessToken, sessionStore } from '../auth/session.js';
import { urlServer } from '../config/server.js';
import { translateNow } from '../i18n/I18nContext.jsx';
import { cleanParams } from '../utils/format.js';

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let unauthorizedHandler = null;
let refreshHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function setRefreshHandler(handler) {
  refreshHandler = handler;
}

function shouldAttachShop(path, opts) {
  if (opts.shopScoped === false) return false;
  if (!sessionStore.get('selected_shop')?.shop_id) return false;

  const pathname = path.startsWith('http') ? new URL(path).pathname : path.split('?')[0];
  return pathname !== '/api/web/shops' && !pathname.startsWith('/api/web_auth/');
}

function addShopToPath(path, shopId) {
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  if (!params.has('shop_id')) params.set('shop_id', String(shopId));
  return `${pathname}?${params}`;
}

function addShopToBody(body, shopId) {
  if (body && typeof body === 'object' && !Array.isArray(body) && !(body instanceof FormData)) {
    return { ...body, shop_id: body.shop_id ?? String(shopId) };
  }
  if (body === undefined || body === null) return { shop_id: String(shopId) };
  return body;
}

async function request(method, path, body, opts = {}) {
  const token = opts.accessToken !== undefined ? opts.accessToken : opts.auth === false ? null : sessionStore.get('token');
  const headers = new Headers(opts.headers || {});
  const selectedShop = sessionStore.get('selected_shop');
  const shopScoped = shouldAttachShop(path, opts);
  const requestPath = shopScoped && method === 'GET' ? addShopToPath(path, selectedShop.shop_id) : path;
  const requestBody = shopScoped && method !== 'GET' ? addShopToBody(body, selectedShop.shop_id) : body;

  if (!headers.has('Content-Type') && requestBody !== undefined && requestBody !== null && !(requestBody instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(urlServer + requestPath, {
    method,
    credentials: 'include',
    cache: opts.cache || 'no-store',
    headers,
    signal: opts.signal,
    body:
      requestBody !== undefined && requestBody !== null && method !== 'GET'
        ? requestBody instanceof FormData
          ? requestBody
          : JSON.stringify(requestBody)
        : undefined,
  });

  if (response.status === 401) {
    const canRefreshSession =
      opts.accessToken === undefined &&
      opts.allowRefresh !== false &&
      hasFullSessionAccessToken() &&
      Boolean(refreshHandler);

    if (canRefreshSession) {
      const refreshed = await refreshHandler().catch(() => false);
      if (refreshed) {
        return request(method, path, body, { ...opts, allowRefresh: false });
      }
      if (!opts.silentUnauthorized) unauthorizedHandler?.();
      throw new ApiError(translateNow('sessionExpired'), { status: 401 });
    }
    throw new ApiError(translateNow('noAccessResource'), { status: 401 });
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.detail || `HTTP ${response.status}`, { status: response.status, data });
  }
  return data;
}

const inflightGets = new Map();

function getInflightKey(url, opts = {}) {
  const token =
    opts.accessToken !== undefined
      ? opts.accessToken || ''
      : opts.auth === false
        ? ''
        : sessionStore.get('token') || '';
  return `${url}\0${token}\0${opts.shopScoped === false ? '0' : '1'}`;
}

const get = (path, params, opts = {}) => {
  const clean = cleanParams(params);
  const url = Object.keys(clean).length ? `${path}?${new URLSearchParams(clean)}` : path;
  if (opts.signal) return request('GET', url, null, opts);

  const key = getInflightKey(url, opts);
  const existing = inflightGets.get(key);
  if (existing) return existing;

  const pending = request('GET', url, null, opts).finally(() => {
    if (inflightGets.get(key) === pending) inflightGets.delete(key);
  });
  inflightGets.set(key, pending);
  return pending;
};

export const api = {
  request,
  get,
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  del: (path, opts) => request('DELETE', path, null, opts),

  auth: {
    adminLogin: (username, password) => api.post('/admin/login', { username, password }),
    refresh: (refresh_token) => api.post('/admin/refresh', { refresh_token }),
    sendSms: (phone, bin) => api.post('/api/send_sms', { phone, bin }),
    checkSms: (phone, code, bin, device_id) =>
      api.post('/api/check_sms_autoinstall', { phone, sms_code: code, bin, device_id }),
  },
  admin: {
    getProducts: (params) => api.get('/admin/admin_get_product_list', params),
    getProduct: (id) => api.get(`/admin/admin_get_product_details/${id}`),
    updateProduct: (id, data) => api.put(`/admin/admin_update_product/${id}`, data),
    getCategories: (params) => api.get('/admin/admin_get_categories', params),
    createCategory: (data) => api.post('/admin/admin_create_new_category', data),
    getBrands: (params) => api.get('/admin/admin_get_brands', params),
    createBrand: (data) => api.post('/admin/admin_create_new_brand', data),
    getUsers: (params) => api.get('/admin/admin_get_users_list', params),
    updateUser: (data) => api.put('/admin/admin_update_user', data),
    getShopsTariffs: (params) => api.get('/admin/admin_get_shops_tariffs', params),
    updateShopTariff: (data) => api.post('/admin/update_shop_tariff', data),
    getTariffs: () => api.get('/admin/get_tariffs'),
    getDistributors: (params) => api.get('/admin/admin_get_distributors', params),
    getBanners: () => api.get('/admin/admin_get_banners'),
    createBanner: (data) => api.post('/admin/admin_create_banner', data),
    deleteBanner: (id) => api.post(`/admin/admin_delete_banner/${id}`),
  },
  sales: {
    fetchByBarcode: (barcode) => api.get('/api/fetch_product_by_barcode', { barcode }),
    fetchFast: () => api.get('/api/fetch_fast_products'),
    createSale: (data) => api.post('/api/create_sale', data),
    processReturn: (data) => api.post('/api/process_return', data),
    fetchClients: () => api.get('/api/fetch_clients'),
    createClient: (data) => api.post('/api/create_client', data),
    updateClient: (id, data) => api.put(`/api/update_client/${id}`, data),
    fetchSuppliers: () => api.get('/api/fetch_suppliers'),
    createSupplier: (data) => api.post('/api/create_supplier', data),
    getSessions: () => api.get('/api/get_sessions'),
    createDisassemble: (data) => api.post('/api/create_disassemble', data),
    createAssemble: (data) => api.post('/api/create_assemble', data),
    insertMoney: (data) => api.post('/api/insert_money', data),
    extractMoney: (data) => api.post('/api/extract_money', data),
    createPurchase: (data) => api.post('/api/create_purchase', data),
    updatePurchase: (data) => api.post('/api/update_purchase', data),
    getReports: (params) => api.get('/web/sales', params),
    getDebts: () => api.get('/api/fetch_debts'),
    payDebt: (data) => api.post('/api/pay_debt', data),
  },
  purchases: {
    getDocuments: (params) => api.get('/api/get_purchase_qdet_documents', params),
    getDetails: (docId) => api.get('/api/get_purchase_details_qdet_documents', { doc_id: docId }),
  },
  webDashboard: {
    getData: (period) => api.get('/api/web/dashboard', { period: period || 'month' }),
  },
  webAuth: {
    generateQr: (opts) => api.post('/api/web_auth/generate_qr', null, { ...opts, auth: false, allowRefresh: false }),
    qrStatus: (token, opts) =>
      api.get('/api/web_auth/qr_status', { token }, { ...opts, auth: false, allowRefresh: false }),
    qrExchange: (token, opts) =>
      api.post('/api/web_auth/qr_exchange', { token }, { ...opts, auth: false, allowRefresh: false }),
    checkPhone: (phone, opts) =>
      api.get('/v2/api/check_phone_for_registration', { phone }, { ...opts, auth: false, allowRefresh: false, shopScoped: false }),
    sendSmsWeb: (phone, opts) =>
      api.post('/api/web_auth/send_sms_web', { phone }, { ...opts, auth: false, allowRefresh: false, shopScoped: false }),
    checkSmsWeb: (phone, smsCode, opts) =>
      api.post('/api/web_auth/check_sms_web', { phone, sms_code: smsCode }, { ...opts, auth: false, allowRefresh: false, shopScoped: false }),
    refresh: (opts) =>
      api.post('/api/web_auth/refresh', null, { ...opts, auth: false, allowRefresh: false, silentUnauthorized: true }),
    logout: (opts) => api.post('/api/web_auth/logout', null, { ...opts, allowRefresh: false, silentUnauthorized: true }),
  },
  web: {
    getShops: (opts) => api.get('/api/web/shops', undefined, { ...opts, shopScoped: false }),
  },
  qdet: {
    getOrders: () => api.get('/api/get_orders_for_qdet_desktop'),
    getOrderDetails: (data) => api.post('/api/get_order_details_for_qdet_desktop', data),
    productByBarcode: (barcode) => api.get(`/product/${barcode}`),
    getSettings: () => api.get('/api/fetch_settings'),
    updateSettings: (data) => api.post('/api/update_settings', data),
  },
  audit: {
    fetchCategories: () => api.get('/api/fetch_categories'),
    fetchProducts: (params) => api.get('/api/fetch_products', params),
    createAudit: (data) => api.post('/api/create_audit_and_goods', data),
    getDocument: (id) => api.get('/api/get_audit_document', { doc_id: id }),
    clearUncounted: (data) => api.post('/api/clear_uncounted_goods', data),
    finishAudit: (data) => api.post('/api/finish_audit', data),
    deleteAudit: (data) => api.post('/api/delete_audit', data),
  },
  b2b: {
    getGoods: (params) => api.get('/api/get_goods_list', params),
    getCategories: () => api.get('/api/get_categories'),
    getOrders: (data) => api.post('/api/b2b_orders', data),
    getOrderDetail: (data) => api.post('/api/get_order_detail', data),
    addToCart: (data) => api.post('/api/add_to_cart', data),
    placeOrder: (data) => api.post('/api/place_order', data),
  },
  nkt: {
    searchByBarcode: (barcode) => api.get(`/web/nkt/${barcode}`),
    searchByName: (q) => api.get('/web/nkt-search', { q }),
    getUnmapped: (limit, exclude_barcodes = [], only_with_barcodes = false) =>
      api.post('/web/nkt/unmapped', { limit, exclude_barcodes, only_with_barcodes }),
    mapGood: (data) => api.post('/web/nkt/map-good', data),
  },
  esf: {
    getList: (params) => api.get('/web/esf/list', params),
    send: (data) => api.post('/web/esf/send', data),
    getDetails: (id) => api.get(`/web/esf/${id}`),
  },
  patchNotes: {
    list: (app) => api.get(`/patch-notes/${app}`),
    get: (app, version) => api.get(`/patch-notes/${app}/${version}`),
  },
  sms: {
    send: (data) => api.post('/api/send_sms_message', data),
  },
  tariff: {
    getShopPhones: (opts) => api.get('/api/web/tariff/shop-phones', undefined, { ...opts, shopScoped: false }),
    getAvailable: (shopId, opts) =>
      api.get('/api/web/tariff/available', { shop_id: shopId }, { ...opts, shopScoped: false }),
    getPendingInvoice: (shopId, opts = {}) =>
      api.get(
        '/api/web/tariff/invoice/pending',
        { shop_id: shopId },
        {
          ...opts,
          shopScoped: false,
          cache: 'no-store',
          headers: { ...(opts.headers || {}), 'Cache-Control': 'no-cache' },
        },
      ),
    getBonusBalance: (shopId, opts) =>
      api.get('/api/web/tariff/bonus-balance', { shop_id: shopId }, { ...opts, shopScoped: false }),
    cancelInvoice: (data, opts = {}) => {
      const shopId = String(data?.shop_id ?? '').trim();
      const invoiceId = Number(data?.invoice_id);
      if (!shopId || !Number.isInteger(invoiceId) || invoiceId <= 0) {
        return Promise.reject(new ApiError(translateNow('tariffInvoiceCancelError'), { status: 422 }));
      }

      const headers = new Headers(opts.headers || {});
      headers.set('Content-Type', 'application/json');
      headers.delete('Idempotency-Key');

      return api.post(
        '/api/web/tariff/invoice/cancel',
        { shop_id: shopId, invoice_id: invoiceId },
        { ...opts, headers, shopScoped: false },
      );
    },
    remotePayRequest: (data, opts = {}) => {
      const headers = new Headers(opts.headers || {});
      if (opts.idempotencyKey) headers.set('Idempotency-Key', opts.idempotencyKey);
      return api.post('/api/web/tariff/remote_pay_request', data, { ...opts, headers, shopScoped: false });
    },
  },
};
