'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

type Placement = 'bottom-start' | 'bottom-end';

/** Tính vị trí fixed bám theo phần tử neo; tự lật lên trên khi thiếu chỗ phía dưới. */
function useFloating(anchor: RefObject<HTMLElement | null>, floating: RefObject<HTMLElement | null>, open: boolean, placement: Placement, matchWidth: boolean) {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const el = floating.current;
    if (!open || !el) return;
    const update = () => {
      const target = anchor.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const width = matchWidth ? rect.width : el.offsetWidth;
      const height = el.offsetHeight;
      const gap = 6;
      let left = placement === 'bottom-end' ? rect.right - width : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - 8 && rect.top - gap - height > 8) top = rect.top - gap - height;
      setStyle({ position: 'fixed', top, left, width: matchWidth ? rect.width : undefined });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, floating, open, placement, matchWidth]);

  return style;
}

type PopoverProps = {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: Placement;
  matchWidth?: boolean;
  className?: string;
  role?: string;
  id?: string;
  label?: string;
};

export function Popover({ anchor, open, onClose, children, placement = 'bottom-start', matchWidth = false, className, role, id, label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const style = useFloating(anchor, ref, open, placement, matchWidth);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      // Popover lồng nhau (ví dụ danh sách chọn bên trong bộ lọc) không làm đóng popover cha.
      if (target.closest?.('.popover')) return;
      onCloseRef.current();
    };
    // Bắt Esc ở pha capture để không đóng luôn modal bên dưới.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, anchor]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} className={`popover${className ? ` ${className}` : ''}`} style={style} role={role} id={id} aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}

export type MenuItem = {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
};

/** Nút "⋯" mở menu thao tác cho một dòng dữ liệu. */
export function RowMenu({ items, label = 'Thao tác' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (open) requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  if (!visible.length) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      <Popover
        anchor={buttonRef}
        open={open}
        onClose={() => {
          setOpen(false);
          buttonRef.current?.focus();
        }}
        placement="bottom-end"
        className="menu"
        role="menu"
        id={menuId}
      >
        <div ref={menuRef} onKeyDown={onKeyDown}>
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                setOpen(false);
                // Trả focus về nút "⋯" trước, để popup mở ra từ thao tác này biết chỗ trả focus khi đóng.
                buttonRef.current?.focus();
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
