import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { decodeJwtPayload, getInitialSession, sessionStore, userFromAccessToken } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { t } = useI18n();
  const [session, setSession] = useState(getInitialSession);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
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
    if (!accessToken) throw new Error(t('sessionExpired'));

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
    const exp = decodeJwtPayload(token)?.exp;
    if (!exp) return;
    const delay = exp * 1000 - Date.now() - 60_000;
    if (delay <= 0) {
      refresh();
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refresh();
    }, delay);
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
    refresh().finally(() => {
      if (active) setIsBootstrapping(false);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...session,
      isLoggedIn: Boolean(session.token),
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
