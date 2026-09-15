'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { byId, formatDate, matches } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { groupPermissions, hasAccess, revokeEntries, type PermissionEntry } from '@/lib/permissions';
import type { Company, Permission, User } from '@/lib/types';
import { useCanManage } from '@/components/AppShell';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, Card, EmptyState, PageHeader, Person } from '@/components/ui/Display';
import { Checkbox, Field, Select } from '@/components/ui/Form';
import { RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Toolbar, type Chip } from '@/components/ui/Toolbar';

export default function ResignedPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const canManage = useCanManage();
  const users = useList<User>('/users');
  const companies = useList<Company>('/companies');
  const permissions = useList<Permission>('/permissions');
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [onlyWithAccess, setOnlyWithAccess] = useState(false);

  const userById = useMemo(() => byId(users.data), [users.data]);
  const accessByUser = useMemo(() => {
    const map = new Map<string, PermissionEntry[]>();
    groupPermissions(permissions.data)
      .filter(hasAccess)
      .forEach((entry) => map.set(entry.user_id, [...(map.get(entry.user_id) ?? []), entry]));
    return map;
  }, [permissions.data]);

  const resigned = useMemo(() => users.data.filter((u) => u.status === 'RESIGNED'), [users.data]);
  const atRisk = resigned.filter((u) => accessByUser.has(u.id)).length;

  const rows = useMemo(
    () =>
      resigned.filter(
        (u) =>
          (!companyId || u.company_id === companyId) &&
          (!onlyWithAccess || accessByUser.has(u.id)) &&
          matches(query, u.full_name, u.employee_code, u.username, u.notes, userById.get(u.replacement_user_id ?? '')?.full_name),
      ),
    [resigned, companyId, onlyWithAccess, query, accessByUser, userById],
  );

  const chips = [
    companyId && { key: 'company', label: companies.data.find((c) => c.id === companyId)?.name ?? 'Công ty', onRemove: () => setCompanyId('') },
    onlyWithAccess && { key: 'access', label: 'Còn quyền truy cập', onRemove: () => setOnlyWithAccess(false) },
  ].filter((chip): chip is Chip => !!chip);

  const revokeAll = async (user: User) => {
    const entries = accessByUser.get(user.id) ?? [];
    const ok = await confirm({
      title: 'Thu hồi toàn bộ quyền truy cập?',
      description: `${user.full_name} đang còn quyền vào ${entries.length} dự án. Tất cả sẽ được chuyển về "Không truy cập".`,
      confirmText: 'Thu hồi tất cả',
    });
    if (!ok) return;
    const { done, failed } = await revokeEntries(entries);
    if (failed) toast.error('Chưa thu hồi hết quyền', `${failed}/${entries.length} quyền thu hồi thất bại, vui lòng thử lại.`);
    if (done) toast.success('Đã thu hồi quyền truy cập', `${user.full_name} · ${done} dự án`);
    permissions.reload();
  };

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nhân viên', sort: (u) => u.full_name, render: (u) => <Person name={u.full_name} sub={u.employee_code} /> },
    {
      key: 'org',
      header: 'Công ty / Phòng ban',
      sort: (u) => u.company_name,
      render: (u) => (
        <span className="cell-stack">
          <span>{u.company_name}</span>
          <span className="cell-sub">{u.department_name ?? 'Chưa có phòng ban'}</span>
        </span>
      ),
    },
    { key: 'date', header: 'Ngày nghỉ', width: 130, sort: (u) => (u.resigned_at ? new Date(u.resigned_at).getTime() : 0), render: (u) => formatDate(u.resigned_at) },
    {
      key: 'replacement',
      header: 'Người thay thế',
      render: (u) => {
        const replacement = userById.get(u.replacement_user_id ?? '');
        return replacement ? <Person name={replacement.full_name} sub={replacement.employee_code} size="sm" /> : <span className="muted">Chưa chỉ định</span>;
      },
    },
    {
      key: 'access',
      header: 'Quyền còn lại',
      width: 150,
      sort: (u) => accessByUser.get(u.id)?.length ?? 0,
      render: (u) => {
        const count = accessByUser.get(u.id)?.length ?? 0;
        return count ? (
          <Link href={`/permissions?user=${u.id}`} className="badge-link">
            <Badge tone="red" dot>
              {count} dự án
            </Badge>
          </Link>
        ) : (
          <Badge tone="green">Đã thu hồi hết</Badge>
        );
      },
    },
    {
      key: 'notes',
      header: 'Ghi chú',
      render: (u) =>
        u.notes ? (
          <span className="clamp-2" title={u.notes}>
            {u.notes}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (u) => (
        <RowMenu
          label={`Thao tác với ${u.full_name}`}
          items={[
            { label: 'Xem quyền truy cập', icon: 'shield', onSelect: () => router.push(`/permissions?user=${u.id}`) },
            { label: 'Thu hồi toàn bộ quyền', icon: 'shield-off', danger: true, hidden: !canManage || !accessByUser.has(u.id), onSelect: () => revokeAll(u) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Theo dõi" title="Nghỉ việc" description="Lịch sử nghỉ việc, người tiếp nhận công việc và các quyền truy cập còn tồn đọng." />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm nhân viên, người thay thế, ghi chú..." />
          <FilterButton
            chips={chips}
            onReset={() => {
              setCompanyId('');
              setOnlyWithAccess(false);
            }}
          >
            <Field label="Công ty">
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Tất cả công ty</option>
                {companies.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox label="Chỉ người còn quyền truy cập" checked={onlyWithAccess} onChange={setOnlyWithAccess} />
          </FilterButton>
          {atRisk > 0 && !onlyWithAccess && (
            <button type="button" className="chip chip-danger" onClick={() => setOnlyWithAccess(true)}>
              {atRisk} người còn quyền truy cập
            </button>
          )}
          <span className="toolbar-spacer" />
          <ResultCount count={rows.length} unit="người" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={users.loading || permissions.loading}
          resetKey={`${query}|${companyId}|${onlyWithAccess}`}
          minWidth={1000}
          defaultSort={{ key: 'date', dir: 'desc' }}
          empty={
            query || chips.length ? (
              <EmptyState title="Không có kết quả phù hợp" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
            ) : (
              <EmptyState icon="user-x" title="Chưa có nhân viên nghỉ việc" description="Khi cho nhân viên nghỉ việc ở trang Nhân viên, hồ sơ sẽ xuất hiện tại đây." />
            )
          }
        />
      </Card>
    </>
  );
}
