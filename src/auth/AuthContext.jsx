import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  clampRefreshDelay,
  getAccessTokenRefreshDelay,
  getInitialSession,
  hasFullSessionAccessToken,
  isAccessTokenFresh,
  isSessionAccessToken,
  sessionStore,
  userFromAccessToken,
} from './session.js';

const AuthContext = createContext(null);

function needsImmediateRefresh(token) {
  if (!isSessionAccessToken(token)) return false;
  const delay = getAccessTokenRefreshDelay(token);
  return delay !== null && delay <= 0;
}

function needsAuthBootstrap() {
  const token = sessionStore.get('token');
  if (!isSessionAccessToken(token)) return false;
  if (needsImmediateRefresh(token)) return true;
  return !(sessionStore.get('shops') || []).length;
}

export function AuthProvider({ children }) {
  const { t } = useI18n();
  const [session, setSession] = useState(getInitialSession);
  const [isBootstrapping, setIsBootstrapping] = useState(needsAuthBootstrap);
  const refreshTimerRef = useRef(null);
  const refreshPromiseRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearRefreshTimer();
    sessionStore.clearAuth();
    setSession({ token: null, user: {}, shops: [], selectedShop: null });
  }, [clearRefreshTimer]);

  const establishSession = useCallback(async (accessToken) => {
    if (!isSessionAccessToken(accessToken)) throw new Error(t('sessionExpired'));

    const user = userFromAccessToken(accessToken);
    sessionStore.set('token', accessToken);
    sessionStore.set('user', user);

    const shopsData = await api.web.getShops();
    const shops = Array.isArray(shopsData?.shops) ? shopsData.shops : [];
    if (!shops.length) throw new Error(t('noShops'));

    const previousShop = sessionStore.get('selected_shop');
    const selectedShop =
      shops.find((shop) => String(shop.shop_id) === String(previousShop?.shop_id)) || shops[0];

    sessionStore.set('shops', shops);
    sessionStore.set('selected_shop', selectedShop);
    setSession({ token: accessToken, user, shops, selectedShop });
    return true;
  }, [t]);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    if (!hasFullSessionAccessToken()) return false;

    refreshPromiseRef.current = api.webAuth
      .refresh()
      .then((data) => establishSession(data?.access_token))
      .catch(() => {
        clearSession();
        return false;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [clearSession, establishSession]);

  const scheduleRefresh = useCallback((token) => {
    clearRefreshTimer();
    if (!isSessionAccessToken(token)) return;

    const delay = getAccessTokenRefreshDelay(token);
    if (delay == null) return;
    if (delay <= 0) {
      refresh();
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refresh();
    }, clampRefreshDelay(delay));
  }, [clearRefreshTimer, refresh]);

  const completeWebLogin = useCallback(async (data) => {
    try {
      await establishSession(data?.access_token);
    } catch (event) {
      clearSession();
      throw event;
    }
  }, [clearSession, establishSession]);

  const selectShop = useCallback((shopId) => {
    const shops = sessionStore.get('shops') || [];
    const selectedShop = shops.find((shop) => String(shop.shop_id) === String(shopId)) || null;
    if (!selectedShop) return false;
    sessionStore.set('selected_shop', selectedShop);
    setSession((current) => ({ ...current, selectedShop }));
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.webAuth.logout();
    } catch {
      // Local logout must always complete even if the server is unavailable.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    scheduleRefresh(session.token);
    return clearRefreshTimer;
  }, [clearRefreshTimer, scheduleRefresh, session.token]);

  useEffect(() => {
    let active = true;
    const finish = () => {
      if (active) setIsBootstrapping(false);
    };
    const token = sessionStore.get('token');

    if (!isSessionAccessToken(token)) {
      finish();
      return () => {
        active = false;
      };
    }

    if (isAccessTokenFresh(token)) {
      if ((sessionStore.get('shops') || []).length) {
        finish();
        return () => {
          active = false;
        };
      }

      establishSession(token).catch(clearSession).finally(finish);
      return () => {
        active = false;
      };
    }

    refresh().finally(finish);
    return () => {
      active = false;
    };
  }, [clearSession, establishSession, refresh]);

  const value = useMemo(
    () => ({
      ...session,
      isLoggedIn: Boolean(session.token) && isSessionAccessToken(session.token),
      isBootstrapping,
      completeQrLogin: completeWebLogin,
      completeWebLogin,
      selectShop,
      refresh,
      logout,
    }),
    [completeWebLogin, isBootstrapping, logout, refresh, selectShop, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
