const Modal = {
  _callbacks: {},

  open(cfg) {
    const { title, body, footer = '', size = '520px', id = 'modal-' + Date.now(), onClose } = cfg;
    if (onClose) {
      this._callbacks[id] = onClose;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay'; overlay.id = id + '-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) Modal.close(id); };
    overlay.innerHTML = `
      <div class="modal fade-in" style="max-width:${size}" id="${id}">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" onclick="Modal.close('${id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    return id;
  },

  close(id) {
    const el = document.getElementById(id + '-overlay') || document.getElementById(id);
    if (el) el.remove();
    if (this._callbacks[id]) {
      try { this._callbacks[id](); } catch (e) { console.error(e); }
      delete this._callbacks[id];
    }
  },

  closeAll() {
    for (const id of Object.keys(this._callbacks)) {
      try { this._callbacks[id](); } catch (e) { console.error(e); }
    }
    this._callbacks = {};
    document.querySelectorAll('.modal-overlay').forEach(e => e.remove());
  }
};
window.Modal = Modal;
