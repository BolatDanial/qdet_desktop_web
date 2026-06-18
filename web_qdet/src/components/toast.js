const Toast = {
  show(msg, type='info', dur=3500) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="font-size:16px">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(120%)'; t.style.transition='0.3s'; setTimeout(()=>t.remove(), 300); }, dur);
  },
  success: (m) => Toast.show(m, 'success'),
  error:   (m) => Toast.show(m, 'error'),
  info:    (m) => Toast.show(m, 'info'),
};
window.Toast = Toast;
