'use client';
import { useId } from 'react';
import { LEVEL_ORDER, LEVELS } from '@/lib/format';
import type { PermissionEntry } from '@/lib/permissions';
import { Icon } from './ui/Icon';

export function LevelLetter({ level, conflict }: { level?: string; conflict?: boolean }) {
  if (conflict) return <span className="level-letter level-CONFLICT">!</span>;
  if (!level) return <span className="level-letter level-EMPTY">–</span>;
  return <span className={`level-letter level-${level}`}>{LEVELS[level]?.short ?? '?'}</span>;
}

/** Nhãn mức quyền; nếu dữ liệu bị trùng với nhiều mức khác nhau thì hiện cảnh báo xung đột. */
export function LevelBadge({ entry }: { entry: Pick<PermissionEntry, 'level' | 'levels' | 'conflict'> }) {
  if (entry.conflict) {
    const labels = entry.levels.map((level) => LEVELS[level]?.label ?? level).join(', ');
    return (
      <span className="badge badge-amber" title={`Nhiều bản ghi trùng nhau: ${labels}`}>
        <Icon name="triangle-alert" size={13} />
        Xung đột · {entry.levels.map((level) => LEVELS[level]?.short ?? level).join('/')}
      </span>
    );
  }
  return (
    <span className="level-badge">
      <LevelLetter level={entry.level} />
      {LEVELS[entry.level]?.label ?? entry.level}
    </span>
  );
}

export function LevelPicker({ value, onChange }: { value: string; onChange: (level: string) => void }) {
  const name = useId();
  return (
    <div className="level-picker" role="radiogroup" aria-label="Mức quyền">
      {LEVEL_ORDER.map((level) => {
        const info = LEVELS[level];
        const checked = value === level;
        return (
          <label key={level} className={`level-option${checked ? ' is-checked' : ''}`}>
            <input type="radio" className="sr-only" name={name} value={level} checked={checked} onChange={() => onChange(level)} />
            <LevelLetter level={level} />
            <span className="level-option-text">
              <strong>{info.label}</strong>
              <small>{info.description}</small>
            </span>
            <span className="radio-dot" aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}
