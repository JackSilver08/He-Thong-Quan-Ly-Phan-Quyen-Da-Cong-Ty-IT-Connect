'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { matches } from '@/lib/format';
import { Icon } from './Icon';
import { Popover } from './Popover';

type FieldState = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldState | null>(null);

function useFieldProps() {
  const field = useContext(FieldContext);
  return field ? { id: field.id, 'aria-describedby': field.describedBy, 'aria-invalid': field.invalid || undefined } : {};
}

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  wide?: boolean;
  children: ReactNode;
};

/** Nhãn + ô nhập + gợi ý/lỗi; ô nhập bên trong tự nhận id và aria từ context. */
export function Field({ label, required, hint, error, wide, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const describedBy = error || hint ? messageId : undefined;
  return (
    <div className={`field${wide ? ' field-wide' : ''}${error ? ' is-invalid' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="field-required" aria-hidden="true">*</span>}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>{children}</FieldContext.Provider>
      {error ? (
        <p className="field-error" id={messageId}>
          <Icon name="circle-alert" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useFieldProps()} {...props} className={`control${className ? ` ${className}` : ''}`} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...useFieldProps()} {...props} className={`control${className ? ` ${className}` : ''}`} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...useFieldProps()} {...props} className={`control control-select${className ? ` ${className}` : ''}`} />;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export type Option = { value: string; label: string; description?: string; keywords?: string };

type ComboboxProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
};

/** Ô chọn có tìm kiếm (không phân biệt dấu) cho danh sách dài như nhân viên, dự án. */
export function Combobox({ options, value, onChange, placeholder = 'Gõ để tìm...', emptyText = 'Không tìm thấy kết quả', disabled, clearable }: ComboboxProps) {
  const fieldProps = useFieldProps();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(
    () => options.filter((option) => matches(query, option.label, option.description, option.keywords)).slice(0, 100),
    [options, query],
  );

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (option: Option) => {
    onChange(option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    }
  };

  return (
    <div ref={wrapRef} className="combobox">
      <input
        {...fieldProps}
        className="control"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : selected?.label ?? ''}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="combobox-icons">
        {clearable && value && !disabled && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Bỏ chọn"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange('')}
          >
            <Icon name="x" size={14} />
          </button>
        )}
        <Icon name="chevron-down" size={16} />
      </span>
      <Popover anchor={wrapRef} open={open && !disabled} onClose={close} matchWidth className="listbox-popover">
        <ul role="listbox" id={listId} className="listbox">
          {filtered.length ? (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`option${index === active ? ' is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span className="option-label">{option.label}</span>
                {option.description && <span className="option-desc">{option.description}</span>}
                {option.value === value && <Icon name="check" size={16} />}
              </li>
            ))
          ) : (
            <li className="option-empty">{emptyText}</li>
          )}
        </ul>
      </Popover>
    </div>
  );
}
