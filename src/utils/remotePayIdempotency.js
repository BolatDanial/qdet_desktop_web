const STORAGE_PREFIX = 'qdet:remote-payment:';

function storageKey(shopId) {
  return `${STORAGE_PREFIX}${String(shopId)}`;
}

function createIdempotencyKey() {
  return crypto.randomUUID();
}

export function readRemotePayRecord(shopId) {
  if (!shopId) return null;
  try {
    const raw = localStorage.getItem(storageKey(shopId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.idempotencyKey || typeof parsed.idempotencyKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRemotePayRecord(shopId, record) {
  localStorage.setItem(
    storageKey(shopId),
    JSON.stringify({
      shopId: String(shopId),
      idempotencyKey: record.idempotencyKey,
      paymentRequest: record.paymentRequest ?? null,
      invoiceId: record.invoiceId ?? null,
      createdAt: record.createdAt || Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

export function startRemotePayRecord(shopId, paymentRequest) {
  const record = {
    idempotencyKey: createIdempotencyKey(),
    paymentRequest: paymentRequest || null,
    invoiceId: null,
    createdAt: Date.now(),
  };
  writeRemotePayRecord(shopId, record);
  return record;
}

export function saveRemotePayRecord(shopId, patch) {
  const current = readRemotePayRecord(shopId) || {};
  const record = {
    ...current,
    ...patch,
    idempotencyKey: patch.idempotencyKey || current.idempotencyKey,
    createdAt: current.createdAt || Date.now(),
  };
  writeRemotePayRecord(shopId, record);
  return record;
}

export function finishRemotePayRecord(shopId) {
  if (!shopId) return;
  localStorage.removeItem(storageKey(shopId));
}

export function syncRemotePayIdempotency(shopId, invoice) {
  if (!shopId) return null;

  const saved = readRemotePayRecord(shopId);

  if (invoice) {
    if (!saved?.idempotencyKey) return saved;
    return saveRemotePayRecord(shopId, {
      invoiceId: invoice.invoice_id ?? invoice.id ?? invoice.invoiceId ?? saved.invoiceId,
    });
  }

  if (!saved?.idempotencyKey || saved.invoiceId) {
    return startRemotePayRecord(shopId);
  }

  return saved;
}

export function prepareRemotePayIdempotency(shopId, paymentRequest) {
  const saved = readRemotePayRecord(shopId);
  if (saved?.idempotencyKey && !saved.invoiceId) {
    return saveRemotePayRecord(shopId, { paymentRequest });
  }
  return startRemotePayRecord(shopId, paymentRequest);
}
