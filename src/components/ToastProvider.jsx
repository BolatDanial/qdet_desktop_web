import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message) => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      warning: (message) => push('warning', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div className="toast-icon">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside ToastProvider');
  return toast;
}
