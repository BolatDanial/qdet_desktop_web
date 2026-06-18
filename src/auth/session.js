const PREFIX = 'qdet_';

let authSession = {
  token: null,
  user: null,
  shops: [],
  selectedShop: null,
};

export const sessionStore = {
  get(key) {
    if (key === 'token') return authSession.token;
    if (key === 'user') return authSession.user;
    if (key === 'shops') return authSession.shops;
    if (key === 'selected_shop') return authSession.selectedShop;
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (key === 'token') {
      authSession = { ...authSession, token: value };
      return;
    }
    if (key === 'user') {
      authSession = { ...authSession, user: value };
      return;
    }
    if (key === 'shops') {
      authSession = { ...authSession, shops: Array.isArray(value) ? value : [] };
      return;
    }
    if (key === 'selected_shop') {
      authSession = { ...authSession, selectedShop: value || null };
      return;
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  remove(key) {
    if (key === 'token') {
      authSession = { ...authSession, token: null };
      return;
    }
    if (key === 'user') {
      authSession = { ...authSession, user: null };
      return;
    }
    if (key === 'shops') {
      authSession = { ...authSession, shops: [] };
      return;
    }
    if (key === 'selected_shop') {
      authSession = { ...authSession, selectedShop: null };
      return;
    }
    localStorage.removeItem(PREFIX + key);
  },
  clear() {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  },
  clearAuth() {
    authSession = { token: null, user: null, shops: [], selectedShop: null };
  },
};

export function getInitialSession() {
  return {
    token: authSession.token,
    user: authSession.user || {},
    shops: authSession.shops,
    selectedShop: authSession.selectedShop,
  };
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function userFromAccessToken(token) {
  const claims = decodeJwtPayload(token) || {};
  const name = claims.phone || claims.user_id || claims.sub || 'Web user';
  return {
    name,
    roleKey: claims.is_owner ? 'ownerRole' : 'userRole',
    type: 'web',
    phone: claims.phone,
    userId: claims.user_id || claims.sub,
    bin: claims.bin,
    sessionId: claims.sid,
  };
}
