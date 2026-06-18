const Auth = {
  async adminLogin(username, password) {
    const data = await API.auth.adminLogin(username, password);
    Store.set('token', data.access_token);
    Store.set('refresh_token', data.refresh_token);
    Store.set('user', { name: username, role: 'Администратор', type: 'admin' });
    return data;
  },

  isLoggedIn() { return !!Store.get('token'); },

  getUser() { return Store.get('user') || {}; },

  logout() {
    Store.clear();
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-screen').classList.remove('hidden');
    Toast.info('Вы вышли из системы');
  }
};
window.Auth = Auth;

// ─── Login UI functions ──────────────────────────────────
let loginTab = 'phone';
function switchLoginTab(tab) {
  loginTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('content-' + tab).classList.add('active');
  clearLoginError();
}

function formatPhone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 10);
  if (v.length >= 7) v = v.slice(0, 3) + ' ' + v.slice(3, 6) + '-' + v.slice(6, 8) + '-' + v.slice(8);
  else if (v.length >= 4) v = v.slice(0, 3) + ' ' + v.slice(3);
  input.value = v;
}

async function sendSmsCode() {
  showLoginError('Этот статический экран входа отключен. Используйте основной веб-клиент.');
}

function otpNext(el, nextId) {
  el.value = el.value.replace(/\D/g, '');
  if (el.value && nextId) document.getElementById(nextId)?.focus();
  checkOtpComplete();
}
function otpBack(e, prevId) { if (e.key === 'Backspace' && !e.target.value) document.getElementById(prevId)?.focus(); }
function checkOtpComplete() {
  const code = [1, 2, 3, 4, 5, 6].map(i => document.getElementById('otp-' + i)?.value || '').join('');
  if (code.length === 6) verifyCode();
}

async function verifyCode() {
  showLoginError('Вход по коду отключен. Используйте QR вход в основном веб-клиенте.');
}

async function adminLogin() {
  const u = document.getElementById('admin-username').value.trim();
  const p = document.getElementById('admin-password').value;
  if (!u || !p) { showLoginError('Заполните все поля'); return; }
  try {
    await Auth.adminLogin(u, p);
    enterApp();
  } catch (e) {
    showLoginError(e.message || 'Неверный логин или пароль');
  }
}

function enterApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('active');
  initApp();
}

function backToPhone() {
  document.getElementById('step-otp').classList.add('hidden');
  document.getElementById('step-phone').classList.remove('hidden');
  [1, 2, 3, 4, 5, 6].forEach(i => { const el = document.getElementById('otp-' + i); if (el) el.value = ''; });
}

let resendInterval;
function startResendTimer() {
  let s = 60;
  const el = document.getElementById('resend-timer');
  if (resendInterval) clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    el.textContent = s > 0 ? `(${s--}с)` : '';
    if (s < 0) clearInterval(resendInterval);
  }, 1000);
}

function resendCode() { sendSmsCode(); }
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.classList.remove('hidden');
}
function clearLoginError() { document.getElementById('login-error').classList.add('hidden'); }
function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}
