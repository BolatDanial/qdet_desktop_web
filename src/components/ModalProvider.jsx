import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const { t } = useI18n();
  const [modals, setModals] = useState([]);

  const close = useCallback((id) => {
    setModals((items) => items.filter((item) => item.id !== id));
  }, []);

  const closeAll = useCallback(() => setModals([]), []);

  const open = useCallback((config) => {
    const id = config.id || crypto.randomUUID();
    setModals((items) => [...items, { ...config, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ open, close, closeAll }), [open, close, closeAll]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modals.map((modal) => (
        <div className="modal-overlay active" key={modal.id} onMouseDown={() => close(modal.id)}>
          <div
            className="modal"
            style={{ maxWidth: modal.size || '520px' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{modal.title}</h3>
              <button className="modal-close" type="button" onClick={() => close(modal.id)} aria-label={t('close')}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{modal.body}</div>
            {modal.footer ? <div className="modal-footer">{modal.footer}</div> : null}
          </div>
        </div>
      ))}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const modal = useContext(ModalContext);
  if (!modal) throw new Error('useModal must be used inside ModalProvider');
  return modal;
}
