/** Simple reactive store */
const Store = {
  _data: {},
  get: (k) => {
    try { return JSON.parse(localStorage.getItem('qdet_' + k)); } catch { return null; }
  },
  set: (k, v) => { localStorage.setItem('qdet_' + k, JSON.stringify(v)); },
  del: (k) => { localStorage.removeItem('qdet_' + k); },
  clear: () => {
    Object.keys(localStorage).filter(k => k.startsWith('qdet_')).forEach(k => localStorage.removeItem(k));
  }
};
window.Store = Store;
