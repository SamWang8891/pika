import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  const toastFn = useMemo(() => {
    const fn = (msg) => addToast(msg, 'info');
    fn.info = (msg) => addToast(msg, 'info');
    fn.success = (msg) => addToast(msg, 'success');
    fn.error = (msg) => addToast(msg, 'error');
    fn.warn = (msg) => addToast(msg, 'warn');
    return fn;
  }, [addToast]);

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <div className={containerClass}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              ...toastStyle,
              ...typeStyles[t.type],
              animation: t.exiting
                ? 'fadeInUp 0.3s ease reverse forwards'
                : 'fadeInUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <span style={iconStyle}>{icons[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  info: '\u2139\uFE0F',
  success: '\u2705',
  error: '\u274C',
  warn: '\u26A0\uFE0F',
};

const containerClass = 'pika-toast-container';

const toastStyle = {
  padding: '12px 20px',
  borderRadius: 14,
  fontFamily: "'Outfit', sans-serif",
  fontSize: '0.88rem',
  fontWeight: 500,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'auto',
};

const typeStyles = {
  info: { background: 'rgba(61,139,95,0.92)', color: '#fff' },
  success: { background: 'rgba(61,139,95,0.92)', color: '#fff' },
  error: { background: 'rgba(217,64,64,0.92)', color: '#fff' },
  warn: { background: 'rgba(232,145,58,0.92)', color: '#fff' },
};

const iconStyle = { fontSize: '1rem', lineHeight: 1 };
