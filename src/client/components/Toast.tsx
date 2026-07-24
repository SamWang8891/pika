import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error' | 'warn';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastFn {
  (msg: string): void;
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
}

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
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

  const toastFn = useMemo<ToastFn>(() => {
    const fn = ((msg: string) => addToast(msg, 'info')) as ToastFn;
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

export function useToast(): ToastFn {
  return useContext(ToastContext) as ToastFn;
}

const icons: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warn: '⚠️',
};

const containerClass = 'pika-toast-container';

const toastStyle: CSSProperties = {
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

const typeStyles: Record<ToastType, CSSProperties> = {
  info: { background: 'rgba(61,139,95,0.92)', color: '#fff' },
  success: { background: 'rgba(61,139,95,0.92)', color: '#fff' },
  error: { background: 'rgba(217,64,64,0.92)', color: '#fff' },
  warn: { background: 'rgba(232,145,58,0.92)', color: '#fff' },
};

const iconStyle: CSSProperties = { fontSize: '1rem', lineHeight: 1 };
