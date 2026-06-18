/**
 * QDET Web — Main Application Controller
 */

// Page registry — must be declared before page files load
window.Pages = window.Pages || {};

// Current page
let currentPage = 'dashboard';

function navigate(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  // Update breadcrumb
  const labels = {
    dashboard: 'Дашборд', sales: 'Продажи', purchases: 'Закупки',
    products: 'Товары', clients: 'Клиенты', reports: 'Отчёты',
    warehouse: 'Остатки', audit: 'Инвентаризация',
    nkt: 'НКТ', esf: 'ЭСФ', snt: 'СНТ', sono: 'СОНО',
    kaspi: 'Kaspi Магазин', wb: 'Wildberries', settings: 'Настройки',
  };
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.textContent = labels[page] || page;

  // Render page
  const container = document.getElementById('page-container');
  const pageObj = window.Pages[page];
  if (!pageObj) { container.innerHTML = `<p>Страница "${page}" не найдена</p>`; return; }

  container.innerHTML = pageObj.render();
  currentPage = page;

  // Init
  if (pageObj.init) {
    try { pageObj.init(); } catch (e) { console.error('Page init error:', e); }
  }

  // Close mobile sidebar
  const sb = document.getElementById('sidebar');
  if (sb && window.innerWidth < 900) sb.classList.remove('mobile-open');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth < 900) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
  }
}

function globalSearch(val) {
  // Debounced search — navigate to products with search
  clearTimeout(window._gsTimer);
  if (val.length >= 2) {
    window._gsTimer = setTimeout(() => {
      navigate('products');
      setTimeout(() => {
        const el = document.getElementById('prod-search');
        if (el) { el.value = val; Pages.products?.search(val); }
      }, 100);
    }, 500);
  }
}

function toggleNotifications() { Toast.info('Уведомлений нет'); }
function toggleUserMenu() {
  const u = Auth.getUser();
  Modal.open({
    title: 'Профиль', body: `
    <div class="flex-col gap-3" style="text-align:center;padding:8px 0">
      <div class="user-avatar" style="width:64px;height:64px;font-size:24px;margin:0 auto">${(u.name || 'U')[0].toUpperCase()}</div>
      <div class="font-bold">${u.name || '—'}</div>
      <div class="badge badge-info" style="margin:0 auto">${u.role || '—'}</div>
    </div>`,
    footer: `<button class="btn btn-ghost" onclick="Modal.closeAll()">Закрыть</button><button class="btn btn-danger" onclick="Modal.closeAll();Auth.logout()">Выйти</button>`
  });
}

function logout() { Auth.logout(); }

function initApp() {
  // Set user info in sidebar
  const user = Auth.getUser();
  const name = user.name || '—';
  const role = user.role || '—';
  const initials = name.replace(/[^a-zA-ZА-Яа-я]/g, '').slice(0, 2).toUpperCase() || '??';

  const ua = document.getElementById('user-avatar');
  const un = document.getElementById('user-name');
  const ur = document.getElementById('user-role');
  const ha = document.getElementById('header-avatar');

  if (ua) ua.textContent = initials;
  if (un) un.textContent = name;
  if (ur) ur.textContent = role;
  if (ha) ha.textContent = initials;

  // Navigate to dashboard
  navigate('dashboard');
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('active');
    initApp();
  }

  // Mobile sidebar overlay close
  document.addEventListener('click', (e) => {
    const sb = document.getElementById('sidebar');
    if (window.innerWidth < 900 && sb?.classList.contains('mobile-open')) {
      if (!sb.contains(e.target) && !e.target.closest('.mobile-menu-btn')) {
        sb.classList.remove('mobile-open');
      }
    }
  });
});
