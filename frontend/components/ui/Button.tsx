import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: IconName;
  loading?: boolean;
  'data-autofocus'?: boolean;
};

export function buttonClass(variant: ButtonProps['variant'] = 'secondary', size: ButtonProps['size'] = 'md') {
  return `btn btn-${variant} btn-${size}`;
}

export function Button({ variant, size, icon, loading, children, className, type = 'button', disabled, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, size)}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}
