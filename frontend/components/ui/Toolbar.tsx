'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Popover } from './Popover';

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(event) => onChange(event.target.value)} />
      {value && (
        <button type="button" className="icon-btn search-clear" aria-label="Xoá tìm kiếm" onClick={() => onChange('')}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export type Chip = { key: string; label: string; onRemove: () => void };

/** Nút "Bộ lọc" mở popup chứa các điều kiện lọc; bộ lọc đang bật hiện thành chip có thể gỡ. */
export function FilterButton({ chips, onReset, children }: { chips: Chip[]; onReset: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary btn-md"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="sliders" size={16} />
        <span>Bộ lọc</span>
        {chips.length > 0 && <span className="btn-count">{chips.length}</span>}
      </button>
      <Popover anchor={buttonRef} open={open} onClose={() => setOpen(false)} className="filter-popover" role="dialog" label="Bộ lọc">
        <div className="filter-head">
          <strong>Bộ lọc</strong>
          <button type="button" className="link-btn" onClick={onReset} disabled={!chips.length}>
            Xoá tất cả
          </button>
        </div>
        <div className="filter-body">{children}</div>
        <div className="filter-foot">
          <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
            Xong
          </Button>
        </div>
      </Popover>
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="chip" onClick={chip.onRemove} aria-label={`Bỏ lọc ${chip.label}`}>
          {chip.label}
          <Icon name="x" size={14} />
        </button>
      ))}
    </>
  );
}

export function ResultCount({ count, unit }: { count: number; unit: string }) {
  return (
    <span className="result-count">
      <strong>{count.toLocaleString('vi-VN')}</strong> {unit}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string; icon?: IconName }>; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} onClick={() => onChange(option.value)}>
          {option.icon && <Icon name={option.icon} size={16} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
