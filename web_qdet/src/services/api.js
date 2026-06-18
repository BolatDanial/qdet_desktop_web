/**
 * QDET Web — API Service Layer
 * Connects to existing FastAPI backend
 */

const urlServer = String(window.urlServer || window.QDET_URL_SERVER || '').replace(/\/+$/, '');
window.urlServer = urlServer;

const api = {
  async request(method, path, body = null, opts = {}) {
    const token = Store.get('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (opts.headers) Object.assign(headers, opts.headers);

    const config = { method, headers };
    if (body && method !== 'GET') config.body = JSON.stringify(body);

    try {
      const res = await fetch(urlServer + path, config);
      if (res.status === 401) { Auth.logout(); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`API ${method} ${path}:`, err);
      throw err;
    }
  },

  get: (path, params) => {
    if (params) {
      const clean = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          clean[k] = v;
        }
      }
      const url = Object.keys(clean).length ? `${path}?${new URLSearchParams(clean)}` : path;
      return api.request('GET', url);
    }
    return api.request('GET', path);
  },
  post: (path, body) => api.request('POST', path, body),
  put:  (path, body) => api.request('PUT',  path, body),
  del:  (path)       => api.request('DELETE', path),

  // ── Auth ──────────────────────────────────────────
  auth: {
    adminLogin: (u, p) => api.post('/admin/login', { username: u, password: p }),
    refresh: (rt) => api.post('/admin/refresh', { refresh_token: rt }),
    sendSms: (phone, bin) => api.post('/api/send_sms', { phone, bin }),
    checkSms: (phone, code, bin, device_id) =>
      api.post('/api/check_sms_autoinstall', { phone, sms_code: code, bin, device_id }),
  },

  // ── Admin ─────────────────────────────────────────
  admin: {
    getProducts: (p) => api.get('/admin/admin_get_product_list', p),
    getProduct:  (id) => api.get(`/admin/admin_get_product_details/${id}`),
    updateProduct: (id, d) => api.put(`/admin/admin_update_product/${id}`, d),
    getCategories: (p) => api.get('/admin/admin_get_categories', p),
    createCategory: (d) => api.post('/admin/admin_create_new_category', d),
    getBrands: (p) => api.get('/admin/admin_get_brands', p),
    createBrand: (d) => api.post('/admin/admin_create_new_brand', d),
    getUsers: (p) => api.get('/admin/admin_get_users_list', p),
    updateUser: (d) => api.put('/admin/admin_update_user', d),
    getShopsTariffs: (p) => api.get('/admin/admin_get_shops_tariffs', p),
    updateShopTariff: (d) => api.post('/admin/update_shop_tariff', d),
    getTariffs: () => api.get('/admin/get_tariffs'),
    getDistributors: (p) => api.get('/admin/admin_get_distributors', p),
    getBanners: () => api.get('/admin/admin_get_banners'),
    createBanner: (d) => api.post('/admin/admin_create_banner', d),
    deleteBanner: (id) => api.post(`/admin/admin_delete_banner/${id}`),
  },

  // ── Mobile Sales (QDET Desktop/Web) ──────────────
  sales: {
    fetchByBarcode: (b) => api.get('/api/fetch_product_by_barcode', { barcode: b }),
    fetchFast: () => api.get('/api/fetch_fast_products'),
    createSale: (d) => api.post('/api/create_sale', d),
    processReturn: (d) => api.post('/api/process_return', d),
    fetchClients: () => api.get('/api/fetch_clients'),
    createClient: (d) => api.post('/api/create_client', d),
    updateClient: (id, d) => api.put(`/api/update_client/${id}`, d),
    fetchSuppliers: () => api.get('/api/fetch_suppliers'),
    createSupplier: (d) => api.post('/api/create_supplier', d),
    getSessions: () => api.get('/api/get_sessions'),
    createDisassemble: (d) => api.post('/api/create_disassemble', d),
    createAssemble: (d) => api.post('/api/create_assemble', d),
    insertMoney: (d) => api.post('/api/insert_money', d),
    extractMoney: (d) => api.post('/api/extract_money', d),
    createPurchase: (d) => api.post('/api/create_purchase', d),
    updatePurchase: (d) => api.post('/api/update_purchase', d),
    // Real web endpoint (no app_info overhead)
    getReports: (p) => api.get('/web/sales', p),
    getDebts: () => api.get('/api/fetch_debts'),
    payDebt: (d) => api.post('/api/pay_debt', d),
  },

  // ── Purchases (real data) ──────────────────────────
  purchases: {
    getDocuments: (p) => api.get('/api/get_purchase_qdet_documents', p),
    getDetails: (docId) => api.get('/api/get_purchase_details_qdet_documents', { doc_id: docId }),
  },

  // ── Web Dashboard (real data) ─────────────────────
  webDashboard: {
    getData: (period) => api.get('/api/web/dashboard', { period: period || 'month' }),
  },

  // ── Web Auth (real SMS login) ─────────────────────
  webAuth: {
    sendSms:   (phone, bin, device_id) => api.post('/web/auth/send-sms',    { phone, bin, device_id }),
    verifySms: (phone, bin, code, device_id) => api.post('/web/auth/verify-sms', { phone, bin, sms_code: code, device_id }),
  },

  // ── QDET Desktop / Backup ─────────────────────────
  qdet: {
    getOrders: () => api.get('/api/get_orders_for_qdet_desktop'),
    getOrderDetails: (d) => api.post('/api/get_order_details_for_qdet_desktop', d),
    productByBarcode: (b) => api.get(`/product/${b}`),
    getSettings: () => api.get('/api/fetch_settings'),
    updateSettings: (d) => api.post('/api/update_settings', d),
  },

  // ── Audit ─────────────────────────────────────────
  audit: {
    fetchCategories: () => api.get('/api/fetch_categories'),
    fetchProducts: (p) => api.get('/api/fetch_products', p),
    createAudit: (d) => api.post('/api/create_audit_and_goods', d),
    getDocument: (id) => api.get('/api/get_audit_document', { doc_id: id }),
    clearUncounted: (d) => api.post('/api/clear_uncounted_goods', d),
    finishAudit: (d) => api.post('/api/finish_audit', d),
    deleteAudit: (d) => api.post('/api/delete_audit', d),
  },

  // ── B2B ───────────────────────────────────────────
  b2b: {
    getGoods: (p) => api.get('/api/get_goods_list', p),
    getCategories: () => api.get('/api/get_categories'),
    getOrders: (d) => api.post('/api/b2b_orders', d),
    getOrderDetail: (d) => api.post('/api/get_order_detail', d),
    addToCart: (d) => api.post('/api/add_to_cart', d),
    placeOrder: (d) => api.post('/api/place_order', d),
  },

  // ── НКТ ──────────────────────────────────────────
  nkt: {
    searchByBarcode: (barcode) => api.get(`/web/nkt/${barcode}`),
    searchByName:    (q)       => api.get('/web/nkt-search', { q }),
    getUnmapped:     (limit, exclude_barcodes = [], only_with_barcodes = false) => 
      api.post('/web/nkt/unmapped', { limit, exclude_barcodes, only_with_barcodes }),
    mapGood:         (data)    => api.post('/web/nkt/map-good', data),
  },

  // ── ЭСФ ──────────────────────────────────────────
  esf: {
    getList: (p) => api.get('/web/esf/list', p),
    send: (d) => api.post('/web/esf/send', d),
    getDetails: (id) => api.get(`/web/esf/${id}`),
  },

  // ── Patch Notes ──────────────────────────────────
  patchNotes: {
    list: (app) => api.get(`/patch-notes/${app}`),
    get: (app, v) => api.get(`/patch-notes/${app}/${v}`),
  },

  // ── SMS ──────────────────────────────────────────
  sms: {
    send: (d) => api.post('/api/send_sms_message', d),
  },
};

window.API = api;
