'use client';
import { Fragment, useMemo, useState } from 'react';
import { actorName, describeAudit, detailRows, entityName, type Lookup } from '@/lib/audit';
import { ACTIONS, byId, ENTITIES, formatDateTime, labelOf, matches, timeAgo } from '@/lib/format';
import { useList } from '@/lib/hooks';
import type { AuditLog, Company, Department, Project, User } from '@/lib/types';
import { AuditText } from '@/components/AuditText';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card, EmptyState, LabelBadge, PageHeader, Person } from '@/components/ui/Display';
import { Combobox, Field, Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Toolbar, type Chip } from '@/components/ui/Toolbar';

export default function AuditPage() {
  const toast = useToast();
  const logs = useList<AuditLog>('/audit-logs');
  const users = useList<User>('/users');
  const companies = useList<Company>('/companies');
  const projects = useList<Project>('/projects');
  const departments = useList<Department>('/departments');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [actorId, setActorId] = useState('');
  const [selected, setSelected] = useState<{ open: boolean; log: AuditLog | null }>({ open: false, log: null });

  const lookup = useMemo<Lookup>(
    () => ({ users: byId(users.data), companies: byId(companies.data), projects: byId(projects.data), departments: byId(departments.data) }),
    [users.data, companies.data, projects.data, departments.data],
  );

  const rows = useMemo(
    () =>
      logs.data.filter((log) => {
        if (action && log.action !== action) return false;
        if (entity && log.entity_type !== entity) return false;
        if (actorId && log.actor_user_id !== actorId) return false;
        const text = describeAudit(log, lookup)
          .map((s) => (typeof s === 'string' ? s : s.strong))
          .join('');
        return matches(query, text, actorName(log, lookup));
      }),
    [logs.data, action, entity, actorId, query, lookup],
  );

  const chips = [
    action && { key: 'action', label: labelOf(ACTIONS, action).label, onRemove: () => setAction('') },
    entity && { key: 'entity', label: ENTITIES[entity] ?? entity, onRemove: () => setEntity('') },
    actorId && { key: 'actor', label: lookup.users.get(actorId)?.full_name ?? 'Người thực hiện', onRemove: () => setActorId('') },
  ].filter((chip): chip is Chip => !!chip);

  const columns: Column<AuditLog>[] = [
    {
      key: 'time',
      header: 'Thời gian',
      width: 190,
      sort: (log) => new Date(log.created_at).getTime(),
      render: (log) => (
        <span className="cell-stack" title={formatDateTime(log.created_at)}>
          <span>{timeAgo(log.created_at)}</span>
          <span className="cell-sub">{formatDateTime(log.created_at)}</span>
        </span>
      ),
    },
    { key: 'actor', header: 'Người thực hiện', sort: (log) => actorName(log, lookup), render: (log) => <Person name={actorName(log, lookup)} size="sm" /> },
    { key: 'action', header: 'Hành động', width: 140, sort: (log) => log.action, render: (log) => <LabelBadge value={labelOf(ACTIONS, log.action)} /> },
    {
      key: 'content',
      header: 'Nội dung',
      render: (log) => (
        <span className="audit-text">
          <AuditText segments={describeAudit(log, lookup)} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (log) => (
        <button type="button" className="icon-btn" aria-label="Xem chi tiết" title="Xem chi tiết" onClick={() => setSelected({ open: true, log })}>
          <Icon name="eye" />
        </button>
      ),
    },
  ];

  const actorOptions = useMemo(
    () => users.data.map((u) => ({ value: u.id, label: u.full_name, description: u.username })),
    [users.data],
  );

  return (
    <>
      <PageHeader
        eyebrow="Theo dõi"
        title="Nhật ký hoạt động"
        description="100 thao tác gần nhất trong hệ thống: đăng nhập, thay đổi dữ liệu và phân quyền."
        actions={
          <Button
            icon="history"
            onClick={async () => {
              if (await logs.reload()) {
                toast.success('Đã làm mới nhật ký', `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
              }
            }}
          >
            Làm mới
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo nội dung hoặc người thực hiện..." />
          <FilterButton
            chips={chips}
            onReset={() => {
              setAction('');
              setEntity('');
              setActorId('');
            }}
          >
            <Field label="Hành động">
              <Select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Tất cả hành động</option>
                {Object.entries(ACTIONS).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Đối tượng">
              <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="">Tất cả đối tượng</option>
                {Object.entries(ENTITIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Người thực hiện">
              <Combobox options={actorOptions} value={actorId} onChange={setActorId} placeholder="Tất cả mọi người" clearable />
            </Field>
          </FilterButton>
          <span className="toolbar-spacer" />
          <ResultCount count={rows.length} unit="hoạt động" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(log) => log.id}
          loading={logs.loading || users.loading}
          resetKey={`${query}|${action}|${entity}|${actorId}`}
          pageSize={15}
          minWidth={900}
          defaultSort={{ key: 'time', dir: 'desc' }}
          empty={
            query || chips.length ? (
              <EmptyState title="Không có hoạt động phù hợp" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
            ) : (
              <EmptyState icon="activity" title="Chưa có hoạt động nào" description="Các thao tác trong hệ thống sẽ được ghi lại tại đây." />
            )
          }
        />
      </Card>
      <AuditDetailModal open={selected.open} log={selected.log} lookup={lookup} onClose={() => setSelected((s) => ({ ...s, open: false }))} />
    </>
  );
}

function AuditDetailModal({ open, log, lookup, onClose }: { open: boolean; log: AuditLog | null; lookup: Lookup; onClose: () => void }) {
  if (!log) return null;
  const details = detailRows(log, lookup);
  const target = entityName(log, lookup);
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Icon name="activity" size={22} />}
      title="Chi tiết hoạt động"
      description={formatDateTime(log.created_at)}
      footer={
        <Button variant="primary" onClick={onClose} data-autofocus>
          Đóng
        </Button>
      }
    >
      <p className="audit-summary">
        <AuditText segments={describeAudit(log, lookup)} />
      </p>
      <dl className="detail-list">
        <dt>Người thực hiện</dt>
        <dd>{actorName(log, lookup)}</dd>
        <dt>Hành động</dt>
        <dd>
          <LabelBadge value={labelOf(ACTIONS, log.action)} />
        </dd>
        <dt>Đối tượng</dt>
        <dd>
          {ENTITIES[log.entity_type] ?? log.entity_type}
          {target && ` · ${target}`}
        </dd>
        {log.entity_id && (
          <>
            <dt>Mã đối tượng</dt>
            <dd className="mono">{log.entity_id}</dd>
          </>
        )}
        {details.map((row) => (
          <Fragment key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </Fragment>
        ))}
      </dl>
    </Modal>
  );
}
