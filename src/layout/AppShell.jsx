import { Bell, Languages, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { useModal } from '../components/ModalProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { pageLabelKeys, visibleNavSections } from './nav.js';

function initials(name = '') {
  return name.replace(/[^a-zA-ZА-Яа-я]/g, '').slice(0, 2).toUpperCase() || '??';
}

export function AppShell() {
  const auth = useAuth();
  const toast = useToast();
  const modal = useModal();
  const { language, languages, setLanguage, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const userInitials = useMemo(() => initials(auth.user?.name), [auth.user?.name]);

  const switchShop = (event) => {
    if (!auth.selectShop(event.target.value)) return;
    setMobileOpen(false);
    navigate('/dashboard');
  };

  useEffect(() => {
    if (search.trim().length < 2) return undefined;
    const timer = window.setTimeout(() => {
      navigate(`/products?q=${encodeURIComponent(search.trim())}`);
      setMobileOpen(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [navigate, search]);

  const showProfile = () => {
    modal.open({
      title: t('profile'),
      body: (
        <div className="flex-col gap-3" style={{ textAlign: 'center', padding: '8px 0' }}>
          <div className="user-avatar" style={{ width: 64, height: 64, fontSize: 24, margin: '0 auto' }}>
            {userInitials}
          </div>
          <div className="font-bold">{auth.user?.name || '—'}</div>
          <div className="badge badge-info" style={{ margin: '0 auto' }}>
            {auth.user?.roleKey ? t(auth.user.roleKey) : auth.user?.role || '—'}
          </div>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-ghost" type="button" onClick={modal.closeAll}>
            {t('close')}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              modal.closeAll();
              auth.logout();
              toast.info(t('loggedOut'));
            }}
          >
            {t('logout')}
          </button>
        </>
      ),
    });
  };

  return (
    <div className="screen active">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Logo />
            <span className="sidebar-title">QDET</span>
          </div>
          <button className="sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)}>
            <Menu size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {auth.shops?.length ? (
            <div className="shop-switcher">
              <label htmlFor="shop-select">{t('shop')}</label>
              <select id="shop-select" value={auth.selectedShop?.shop_id || ''} onChange={switchShop}>
                {auth.shops.map((shop) => (
                  <option value={shop.shop_id} key={shop.shop_id}>
                    {shop.shop_name || shop.shop_id}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {visibleNavSections.map((section) => (
            <div className="nav-section" key={section.titleKey}>
              <span className="nav-section-title">{t(section.titleKey)}</span>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    className="nav-item"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="nav-icon" />
                    <span>{t(item.labelKey)}</span>
                    {item.badge ? <span className={`nav-badge ${item.badgeClass || 'new'}`}>{item.badge}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{userInitials}</div>
            <div className="user-details">
              <p className="user-name">{auth.user?.name || '—'}</p>
              <p className="user-role">{auth.user?.roleKey ? t(auth.user.roleKey) : auth.user?.role || '—'}</p>
            </div>
          </div>
          <button className="btn-logout" type="button" onClick={auth.logout} title={t('logout')}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <button className="mobile-menu-btn" type="button" onClick={() => setMobileOpen((value) => !value)}>
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              <span>{t(pageLabelKeys[location.pathname]) || 'QDET'}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="header-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="text" placeholder={t('searchPlaceholder')} />
            </div>
            <div className="header-control">
              <Languages size={16} />
              <select aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.short}
                  </option>
                ))}
              </select>
            </div>
            <button className="header-icon-btn" type="button" title={t('theme')} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="header-icon-btn" type="button" title={t('notifications')} onClick={() => toast.info(t('noNotifications'))}>
              <Bell size={20} />
            </button>
            <button className="header-user-btn" type="button" onClick={showProfile} aria-label={t('profile')}>
              <div className="header-avatar">{userInitials}</div>
            </button>
          </div>
        </header>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
