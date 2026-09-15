const PREFIX = 'qdet_';
const AUTH_STORAGE_KEY = `${PREFIX}web_auth`;
const MAX_REFRESH_DELAY_MS = 2_147_483_647;

export const REFRESH_SKEW_MS = 60_000;

function emptyAuthSession() {
  return { token: null, user: null, shops: [], selectedShop: null };
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

export function isSessionAccessToken(token) {
  const claims = decodeJwtPayload(token);
  if (!claims) return false;
  return Boolean(claims.sid || claims.user_id || claims.phone || claims.sub);
}

export function getAccessTokenRefreshDelay(token, skewMs = REFRESH_SKEW_MS) {
  const exp = decodeJwtPayload(token)?.exp;
  if (!exp) return null;
  return exp * 1000 - Date.now() - skewMs;
}

export function isAccessTokenFresh(token, skewMs = REFRESH_SKEW_MS) {
  const delay = getAccessTokenRefreshDelay(token, skewMs);
  return delay === null || delay > 0;
}

export function clampRefreshDelay(delay) {
  if (delay == null || delay <= 0) return 0;
  return Math.min(delay, MAX_REFRESH_DELAY_MS);
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

function readStoredAuthSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return emptyAuthSession();
    const parsed = JSON.parse(raw);
    if (!isSessionAccessToken(parsed?.token)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return emptyAuthSession();
    }
    return {
      token: parsed.token,
      user: parsed.user && typeof parsed.user === 'object' ? parsed.user : userFromAccessToken(parsed.token),
      shops: Array.isArray(parsed.shops) ? parsed.shops : [],
      selectedShop: parsed.selectedShop || null,
    };
  } catch {
    return emptyAuthSession();
  }
}

function writeStoredAuthSession(session) {
  try {
    if (!isSessionAccessToken(session?.token)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: session.token,
        user: session.user,
        shops: session.shops,
        selectedShop: session.selectedShop,
      }),
    );
  } catch {
    // Private mode or a full quota should not break auth in memory.
  }
}

let authSession = readStoredAuthSession();

function replaceAuthSession(next) {
  authSession = next;
  writeStoredAuthSession(authSession);
}

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
      replaceAuthSession({ ...authSession, token: isSessionAccessToken(value) ? value : null });
      return;
    }
    if (key === 'user') {
      replaceAuthSession({ ...authSession, user: value });
      return;
    }
    if (key === 'shops') {
      replaceAuthSession({ ...authSession, shops: Array.isArray(value) ? value : [] });
      return;
    }
    if (key === 'selected_shop') {
      replaceAuthSession({ ...authSession, selectedShop: value || null });
      return;
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  remove(key) {
    if (key === 'token') {
      replaceAuthSession({ ...authSession, token: null });
      return;
    }
    if (key === 'user') {
      replaceAuthSession({ ...authSession, user: null });
      return;
    }
    if (key === 'shops') {
      replaceAuthSession({ ...authSession, shops: [] });
      return;
    }
    if (key === 'selected_shop') {
      replaceAuthSession({ ...authSession, selectedShop: null });
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
    replaceAuthSession(emptyAuthSession());
  },
};

export function hasFullSessionAccessToken() {
  return isSessionAccessToken(authSession.token);
}

export function getInitialSession() {
  return {
    token: authSession.token,
    user: authSession.user || {},
    shops: authSession.shops,
    selectedShop: authSession.selectedShop,
  };
}
