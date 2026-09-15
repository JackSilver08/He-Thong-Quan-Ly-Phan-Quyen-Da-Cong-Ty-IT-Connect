'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { actorName, describeAudit, type Lookup } from '@/lib/audit';
import { ACTIONS, byId, labelOf, timeAgo, USER_STATUS } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { groupPermissions, hasAccess, type PermissionEntry } from '@/lib/permissions';
import type { AuditLog, Company, Department, Permission, Project, User } from '@/lib/types';
import { useCanManage, useMe } from '@/components/AppShell';
import { AuditText } from '@/components/AuditText';
import { buttonClass } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card, EmptyState, LabelBadge, PageHeader, Person, StatCard } from '@/components/ui/Display';
import { Icon, type IconName } from '@/components/ui/Icon';

const ACTION_ICONS: Record<string, IconName> = {
  LOGIN: 'log-in',
  CREATE: 'plus',
  UPDATE: 'pencil',
  DELETE: 'trash',
  RESIGN: 'user-x',
  SET_PERMISSION: 'shield',
};

type CompanyRow = Company & { active: number; departments: number; projects: number; grants: number };

export default function DashboardPage() {
  const me = useMe();
  const canManage = useCanManage();
  const users = useList<User>('/users');
  const companies = useList<Company>('/companies');
  const departments = useList<Department>('/departments');
  const projects = useList<Project>('/projects');
  const permissions = useList<Permission>('/permissions');
  const audit = useList<AuditLog>('/audit-logs');

  const loading = users.loading || companies.loading || projects.loading || permissions.loading;
  const lookup = useMemo<Lookup>(
    () => ({ users: byId(users.data), companies: byId(companies.data), projects: byId(projects.data), departments: byId(departments.data) }),
    [users.data, companies.data, projects.data, departments.data],
  );
  const granted = useMemo(() => groupPermissions(permissions.data).filter(hasAccess), [permissions.data]);

  const active = users.data.filter((u) => u.status === 'ACTIVE').length;
  const resigned = users.data.filter((u) => u.status === 'RESIGNED').length;

  // Người không còn làm việc (nghỉ việc / vô hiệu hoá) nhưng vẫn giữ quyền truy cập dự án.
  const risks = useMemo(() => {
    const map = new Map<string, { user: User; entries: PermissionEntry[] }>();
    for (const entry of granted) {
      const user = lookup.users.get(entry.user_id);
      if (!user || user.status === 'ACTIVE') continue;
      const item = map.get(user.id) ?? { user, entries: [] };
      item.entries.push(entry);
      map.set(user.id, item);
    }
    return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
  }, [granted, lookup]);

  const companyRows = useMemo<CompanyRow[]>(
    () =>
      companies.data.map((c) => {
        const projectIds = new Set(projects.data.filter((p) => p.company_id === c.id).map((p) => p.id));
        return {
          ...c,
          active: users.data.filter((u) => u.company_id === c.id && u.status === 'ACTIVE').length,
          departments: departments.data.filter((d) => d.company_id === c.id).length,
          projects: projectIds.size,
          grants: granted.filter((e) => projectIds.has(e.project_id)).length,
        };
      }),
    [companies.data, projects.data, users.data, departments.data, granted],
  );

  const companyColumns: Column<CompanyRow>[] = [
    {
      key: 'name',
      header: 'Công ty',
      sort: (c) => c.name,
      render: (c) => (
        <span className="cell-inline">
          <span className="code-chip">{c.code}</span>
          <strong className="cell-title">{c.name}</strong>
        </span>
      ),
    },
    { key: 'active', header: 'Nhân viên đang làm', sort: (c) => c.active, render: (c) => c.active },
    { key: 'departments', header: 'Phòng ban', sort: (c) => c.departments, render: (c) => c.departments },
    { key: 'projects', header: 'Dự án', sort: (c) => c.projects, render: (c) => c.projects },
    { key: 'grants', header: 'Quyền đang cấp', sort: (c) => c.grants, render: (c) => c.grants },
  ];

  const greeting = me ? `Xin chào, ${me.full_name}.` : 'Xin chào.';

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Bảng điều khiển"
        description={`${greeting} Tình hình nhân sự và quyền truy cập trên toàn hệ thống.`}
        actions={
          canManage && (
            <>
              <Link href="/permissions?new=1" className={buttonClass('secondary')}>
                <Icon name="shield" />
                <span>Cấp quyền</span>
              </Link>
              <Link href="/users?new=1" className={buttonClass('primary')}>
                <Icon name="user-plus" />
                <span>Thêm nhân viên</span>
              </Link>
            </>
          )
        }
      />

      <div className="stats">
        <StatCard label="Nhân viên đang làm việc" value={active} icon="users" tone="blue" loading={loading} foot={`Trên tổng ${users.data.length} tài khoản`} />
        <StatCard label="Công ty" value={companies.data.length} icon="building" tone="dark" loading={loading} foot={`${departments.data.length} phòng ban`} />
        <StatCard label="Dự án" value={projects.data.length} icon="folder" tone="sky" loading={loading} foot={`${granted.length} quyền truy cập đang cấp`} />
        <StatCard
          label="Đã nghỉ việc"
          value={resigned}
          icon="user-x"
          tone="red"
          loading={loading}
          foot={risks.length ? `${risks.length} người vẫn còn quyền truy cập` : 'Không còn quyền tồn đọng'}
          footDanger={risks.length > 0}
        />
      </div>

      <div className="dash-grid">
        <Card
          title="Cảnh báo truy cập"
          description="Nhân viên đã nghỉ hoặc bị vô hiệu hoá nhưng vẫn còn quyền vào dự án."
          actions={
            <Link href="/resigned" className="link link-arrow">
              Xử lý <Icon name="arrow-right" size={14} />
            </Link>
          }
        >
          <div className="card-body">
            {loading ? (
              <span className="skeleton" />
            ) : risks.length ? (
              <ul className="risk-list">
                {risks.slice(0, 6).map(({ user, entries }) => (
                  <li key={user.id}>
                    <Person name={user.full_name} sub={`${labelOf(USER_STATUS, user.status).label} · ${user.company_name}`} />
                    <Link href={`/permissions?user=${user.id}`} className="badge-link">
                      <span className="badge badge-red badge-dot">{entries.length} dự án</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="shield" tone="green" title="Mọi thứ đều ổn" description="Không có nhân viên đã nghỉ nào còn giữ quyền truy cập." />
            )}
          </div>
        </Card>

        <Card
          title="Hoạt động gần đây"
          actions={
            <Link href="/audit" className="link link-arrow">
              Xem tất cả <Icon name="arrow-right" size={14} />
            </Link>
          }
        >
          <div className="card-body">
            {audit.loading || users.loading ? (
              <span className="skeleton" />
            ) : audit.data.length ? (
              <ul className="activity">
                {audit.data.slice(0, 7).map((log) => (
                  <li key={log.id}>
                    <span className={`activity-icon tone-${labelOf(ACTIONS, log.action).tone}`}>
                      <Icon name={ACTION_ICONS[log.action] ?? 'activity'} size={15} />
                    </span>
                    <div>
                      <p className="activity-text">
                        <AuditText segments={describeAudit(log, lookup)} />
                      </p>
                      <p className="activity-meta">
                        {actorName(log, lookup)} · {timeAgo(log.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="activity" title="Chưa có hoạt động" />
            )}
          </div>
        </Card>
      </div>

      <Card title="Theo công ty" description="Quy mô nhân sự và phạm vi phân quyền của từng công ty.">
        <DataTable
          columns={companyColumns}
          rows={companyRows}
          rowKey={(c) => c.id}
          loading={loading}
          pageSize={8}
          minWidth={640}
          defaultSort={{ key: 'active', dir: 'desc' }}
          empty={<EmptyState icon="building" title="Chưa có công ty" />}
        />
      </Card>
    </>
  );
}
