import type { ReactNode } from 'react';
import { initials, type Label, type Tone } from '@/lib/format';
import { Icon, type IconName } from './Icon';

export function Badge({ tone = 'gray', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={`badge badge-${tone}${dot ? ' badge-dot' : ''}`}>{children}</span>;
}

export function LabelBadge({ value, dot }: { value: Label; dot?: boolean }) {
  return (
    <Badge tone={value.tone} dot={dot}>
      {value.label}
    </Badge>
  );
}

function avatarTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 5;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} data-tone={avatarTone(name)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, size, extra }: { name: string; sub?: ReactNode; size?: 'sm' | 'md'; extra?: ReactNode }) {
  return (
    <span className="person">
      <Avatar name={name} size={size} />
      <span className="person-text">
        <span className="person-name">
          {name}
          {extra}
        </span>
        {sub && <span className="person-sub">{sub}</span>}
      </span>
    </span>
  );
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'blue' | 'green';
};

export function EmptyState({ icon = 'search', title, description, action, tone = 'blue' }: EmptyStateProps) {
  return (
    <div className={`empty empty-${tone}`}>
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, actions, children, className }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {title && (
        <header className="card-header">
          <div>
            <h2 className="card-title">{title}</h2>
            {description && <p className="card-desc">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: IconName;
  tone: 'blue' | 'dark' | 'sky' | 'red';
  foot: ReactNode;
  footDanger?: boolean;
  loading?: boolean;
};

export function StatCard({ label, value, icon, tone, foot, footDanger, loading }: StatCardProps) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      {loading ? <span className="skeleton skeleton-lg" /> : <span className="stat-value">{value.toLocaleString('vi-VN')}</span>}
      <span className={`stat-foot${footDanger ? ' is-danger' : ''}`}>{loading ? ' ' : foot}</span>
    </div>
  );
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger'; title?: string; children: ReactNode }) {
  const icon: IconName = tone === 'info' ? 'info' : 'triangle-alert';
  return (
    <div className={`alert alert-${tone}`} role={tone === 'info' ? undefined : 'note'}>
      <Icon name={icon} size={18} />
      <div>
        {title && <strong className="alert-title">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
