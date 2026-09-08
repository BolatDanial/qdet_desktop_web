import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

const ModalContext = createContext(null);
const INTERACT_GUARD_MS = 400;

export function ModalProvider({ children }) {
  const { t } = useI18n();
  const [modals, setModals] = useState([]);
  const lastOpenAtRef = useRef(0);
  const [sheetLocked, setSheetLocked] = useState(false);

  useEffect(() => {
    if (!modals.length) {
      setSheetLocked(false);
      return undefined;
    }

    lastOpenAtRef.current = Date.now();
    setSheetLocked(true);
    const timer = window.setTimeout(() => setSheetLocked(false), INTERACT_GUARD_MS);
    return () => window.clearTimeout(timer);
  }, [modals]);

  const close = useCallback((id) => {
    setModals((items) => items.filter((item) => item.id !== id));
  }, []);

  const closeAll = useCallback(() => setModals(() => []), []);

  const open = useCallback((config) => {
    const id = config.id || crypto.randomUUID();
    setModals((items) => {
      const next = { ...config, id };
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return [...items, next];
      return items.map((item, idx) => (idx === index ? next : item));
    });
    return id;
  }, []);

  const value = useMemo(() => ({ open, close, closeAll }), [open, close, closeAll]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modals.map((modal) => (
        <div
          className={`modal-overlay active${sheetLocked ? ' modal-overlay-locked' : ''}`}
          key={modal.id}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            if (Date.now() - lastOpenAtRef.current < INTERACT_GUARD_MS) return;
            close(modal.id);
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: modal.size || '520px',
              pointerEvents: sheetLocked ? 'none' : undefined,
            }}
            onClick={(event) => event.stopPropagation()}
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
