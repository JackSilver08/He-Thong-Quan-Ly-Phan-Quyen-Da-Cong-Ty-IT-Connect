'use client';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const EXIT_MS = 180;
const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// Các modal đang mở, phần tử cuối là modal trên cùng (chỉ nó nhận Esc/Tab).
const stack: HTMLElement[] = [];

/** Giữ component trong DOM thêm một nhịp sau khi đóng để chạy hiệu ứng thoát. */
export function useDelayedUnmount(open: boolean, ms = EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);
  return mounted;
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: 'blue' | 'red' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  footer?: ReactNode;
  /** Có onSubmit thì nội dung + footer được bọc trong <form> (Enter để gửi). */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  busy?: boolean;
};

export function Modal({ open, onClose, title, description, icon, tone = 'blue', size = 'md', children, footer, onSubmit, busy }: ModalProps) {
  const mounted = useDelayedUnmount(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(panel);
    document.body.style.overflow = 'hidden';
    const inBody = FOCUSABLE.split(', ').map((selector) => `.modal-body ${selector}`).join(', ');
    const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>(inBody) ?? panel;
    target.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
      } else if (event.key === 'Tab') {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(panel), 1);
      if (!stack.length) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, mounted]);

  if (!mounted || typeof document === 'undefined') return null;

  const content = (
    <>
      {children && <div className="modal-body">{children}</div>}
      {footer && <footer className="modal-footer">{footer}</footer>}
    </>
  );

  return createPortal(
    <div className={`modal-root${open ? '' : ' is-closing'}`}>
      <div className="modal-backdrop" onMouseDown={() => !busy && onClose()} />
      <div
        ref={panelRef}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="modal-header">
          {icon && <div className={`modal-icon tone-${tone}`}>{icon}</div>}
          <div className="modal-heading">
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="icon-btn modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}>
            <Icon name="x" />
          </button>
        </header>
        {onSubmit ? (
          <form className="modal-form" onSubmit={onSubmit} noValidate>
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>,
    document.body,
  );
}
