'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  /** Tăng khi cùng một thông báo được bắn lại, để chạy lại thanh đếm lùi. */
  version: number;
  leaving: boolean;
};

type ToastApi = Record<ToastType, (title: string, description?: string) => void>;

const DURATION = 5000;
const EXIT_MS = 200;
const MAX_VISIBLE = 5;
const ICONS: Record<ToastType, IconName> = {
  success: 'circle-check',
  error: 'circle-alert',
  info: 'info',
  warning: 'triangle-alert',
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    window.setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback((type: ToastType, title: string, description?: string) => {
    const id = nextId.current++;
    setItems((list) => {
      const same = list.find((item) => !item.leaving && item.type === type && item.title === title && item.description === description);
      if (same) return list.map((item) => (item === same ? { ...item, version: item.version + 1 } : item));
      return [{ id, type, title, description, version: 0, leaving: false }, ...list].slice(0, MAX_VISIBLE);
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
      warning: (title, description) => push('warning', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Thông báo" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}${item.leaving ? ' is-leaving' : ''}`}>
            <span className="toast-icon">
              <Icon name={ICONS[item.type]} size={18} />
            </span>
            <div className="toast-body">
              <p className="toast-title">{item.title}</p>
              {item.description && <p className="toast-desc">{item.description}</p>}
            </div>
            <button type="button" className="icon-btn toast-close" aria-label="Đóng thông báo" onClick={() => dismiss(item.id)}>
              <Icon name="x" size={16} />
            </button>
            <span className="toast-track" aria-hidden="true">
              {/* Thanh chạy lùi 5 giây; hết thời gian thì tự đóng. Rê chuột vào thông báo để tạm dừng. */}
              <span
                key={item.version}
                className="toast-progress"
                style={{ animationDuration: `${DURATION}ms` }}
                onAnimationEnd={() => dismiss(item.id)}
              />
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
