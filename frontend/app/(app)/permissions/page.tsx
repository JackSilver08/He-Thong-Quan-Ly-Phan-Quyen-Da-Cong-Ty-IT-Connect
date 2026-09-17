'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { byId, clearQuery, fixVietnameseEncoding, labelOf, LEVELS, LEVEL_ORDER, matches, readQuery, USER_STATUS } from '@/lib/format';
import { useForm, useList } from '@/lib/hooks';
import { entryKey, groupPermissions, hasAccess, type PermissionEntry } from '@/lib/permissions';
import type { Company, Permission, Project, Resource, User } from '@/lib/types';
import { downloadExcel } from '@/lib/export';
import { ImportModal } from '@/components/ImportModal';
import { useCanManage } from '@/components/AppShell';
import { LevelBadge, LevelLetter, LevelPicker } from '@/components/PermissionLevel';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Alert, Card, EmptyState, LabelBadge, PageHeader, Person } from '@/components/ui/Display';
import { Checkbox, Combobox, Field, Select, type Option } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Popover, RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Segmented, Toolbar, type Chip } from '@/components/ui/Toolbar';

type View = 'list' | 'matrix';
type GrantInitial = { user_id?: string; project_id?: string; resource_id?: string | null; level?: string; locked?: boolean };
type Filters = { userId: string; projectId: string; level: string; showRevoked: boolean };

const noFilters: Filters = { userId: '', projectId: '', level: '', showRevoked: false };

export default function PermissionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCanManage();
  const permissions = useList<Permission>('/permissions');
  const users = useList<User>('/users');
  const projects = useList<Project>('/projects');
  const companies = useList<Company>('/companies');
  const [view, setView] = useState<View>('list');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [grant, setGrant] = useState<{ open: boolean; initial: GrantInitial }>({ open: false, initial: {} });
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Liên kết từ trang khác: ?user=, ?project= để lọc sẵn; ?new=1 để mở popup cấp quyền.
  useEffect(() => {
    const user = readQuery('user');
    const project = readQuery('project');
    const isNew = readQuery('new');
    if (user || project) setFilters((f) => ({ ...f, userId: user ?? '', projectId: project ?? '' }));
    if (isNew) setGrant({ open: true, initial: {} });
    clearQuery();
  }, []);

  const userById = useMemo(() => byId(users.data), [users.data]);
  const projectById = useMemo(() => byId(projects.data), [projects.data]);
  const entries = useMemo(() => groupPermissions(permissions.data), [permissions.data]);
  const conflictCount = entries.filter((e) => e.conflict).length;

  const userName = (e: PermissionEntry) => fixVietnameseEncoding(userById.get(e.user_id)?.full_name ?? e.user_name);
  const projectLabel = (e: PermissionEntry) => {
    const project = projectById.get(e.project_id);
    return fixVietnameseEncoding(project ? `${project.code} · ${project.name}` : e.project_name);
  };

  const rows = useMemo(
    () =>
      entries.filter((e) => {
        if (!filters.showRevoked && !hasAccess(e)) return false;
        if (filters.userId && e.user_id !== filters.userId) return false;
        if (filters.projectId && e.project_id !== filters.projectId) return false;
        if (filters.level && !e.levels.includes(filters.level)) return false;
        const user = userById.get(e.user_id);
        const project = projectById.get(e.project_id);
        return matches(query, user?.full_name ?? e.user_name, user?.username, user?.employee_code, project?.code, project?.name ?? e.project_name, project?.company_name, e.resource_name);
      }),
    [entries, filters, query, userById, projectById],
  );

  const userOptions = useMemo<Option[]>(
    () => users.data.map((u) => ({ value: u.id, label: fixVietnameseEncoding(u.full_name), description: `${u.employee_code} · ${u.company_name}`, keywords: `${u.username} ${u.email}` })),
    [users.data],
  );
  const projectOptions = useMemo<Option[]>(
    () => projects.data.map((p) => ({ value: p.id, label: fixVietnameseEncoding(`${p.code} · ${p.name}`), description: p.company_name })),
    [projects.data],
  );

  const chips = [
    filters.userId && { key: 'user', label: userById.get(filters.userId)?.full_name ?? 'Nhân viên', onRemove: () => setFilters((f) => ({ ...f, userId: '' })) },
    filters.projectId && { key: 'project', label: projectById.get(filters.projectId)?.code ?? 'Dự án', onRemove: () => setFilters((f) => ({ ...f, projectId: '' })) },
    filters.level && { key: 'level', label: LEVELS[filters.level]?.label ?? filters.level, onRemove: () => setFilters((f) => ({ ...f, level: '' })) },
    filters.showRevoked && { key: 'revoked', label: 'Gồm quyền đã thu hồi', onRemove: () => setFilters((f) => ({ ...f, showRevoked: false })) },
  ].filter((chip): chip is Chip => !!chip);

  const setLevel = async (user: User, project: Project, level: string) => {
    try {
      await api('/permissions', { method: 'POST', body: JSON.stringify({ user_id: user.id, project_id: project.id, resource_id: null, level }) });
      toast.success('Đã cập nhật quyền', `${user.full_name} · ${project.code}: ${LEVELS[level].label}`);
      await permissions.reload();
    } catch (err) {
      toast.error('Không lưu được quyền', errorMessage(err));
    }
  };

  const revoke = async (entry: PermissionEntry) => {
    const ok = await confirm({
      title: 'Thu hồi quyền truy cập?',
      description: `${userName(entry)} sẽ không còn quyền vào dự án ${projectLabel(entry)}.`,
      confirmText: 'Thu hồi quyền',
    });
    if (!ok) return;
    try {
      await api('/permissions', {
        method: 'POST',
        body: JSON.stringify({ user_id: entry.user_id, project_id: entry.project_id, resource_id: entry.resource_id, level: 'NONE' }),
      });
      toast.success('Đã thu hồi quyền', `${userName(entry)} · ${projectLabel(entry)}`);
      permissions.reload();
    } catch (err) {
      toast.error('Không thu hồi được quyền', errorMessage(err));
    }
  };

  const allColumns: Column<PermissionEntry>[] = [
    {
      key: 'user',
      header: 'Nhân viên',
      sort: userName,
      render: (e) => {
        const user = userById.get(e.user_id);
        return (
          <Person
            name={userName(e)}
            sub={user ? user.username : 'Tài khoản đã bị xoá'}
            extra={user && user.status !== 'ACTIVE' ? <LabelBadge value={labelOf(USER_STATUS, user.status)} /> : undefined}
          />
        );
      },
    },
    {
      key: 'project',
      header: 'Dự án',
      sort: projectLabel,
      render: (e) => {
        const project = projectById.get(e.project_id);
        return (
          <span className="cell-stack">
            <strong className="cell-title">{project?.name ?? e.project_name}</strong>
            <span className="cell-sub cell-inline">
              {project && <span className="code-chip code-chip-sm">{project.code}</span>}
              {project?.company_name ?? 'Dự án đã bị xoá'}
            </span>
          </span>
        );
      },
    },
    { key: 'scope', header: 'Phạm vi', width: 160, render: (e) => e.resource_name ?? <span className="muted">Toàn dự án</span> },
    { key: 'level', header: 'Mức quyền', width: 190, sort: (e) => LEVEL_ORDER.indexOf(e.level), render: (e) => <LevelBadge entry={e} /> },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (e) => (
        <RowMenu
          label={`Thao tác với quyền của ${userName(e)}`}
          items={[
            {
              label: 'Đổi mức quyền',
              icon: 'pencil',
              onSelect: () => setGrant({ open: true, initial: { user_id: e.user_id, project_id: e.project_id, resource_id: e.resource_id, level: e.level, locked: true } }),
            },
            { label: 'Thu hồi quyền', icon: 'shield-off', danger: true, hidden: !hasAccess(e), onSelect: () => revoke(e) },
          ]}
        />
      ),
    },
  ];
  const columns = canManage ? allColumns : allColumns.filter((column) => column.key !== 'actions');

  const loading = permissions.loading || users.loading || projects.loading;
  const filtered = !!(query || chips.length);
  const openGrant = () => setGrant({ open: true, initial: {} });

  return (
    <>
      <PageHeader
        eyebrow="Truy cập"
        title="Phân quyền"
        description="Ai được vào dự án nào, với mức quyền gì."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              icon="download"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadExcel('/export/permissions', 'Ma_tran_phan_quyen.xlsx');
                  toast.success('Đã xuất file Ma trận phân quyền Excel');
                } catch (err) {
                  toast.error('Không xuất được file', errorMessage(err));
                } finally {
                  setExporting(false);
                }
              }}
            >
              Xuất Excel (Ma trận)
            </Button>
            {canManage && (
              <>
                <Button variant="secondary" icon="upload" onClick={() => setImportOpen(true)}>
                  Nhập Excel
                </Button>
                <Button variant="primary" icon="plus" onClick={openGrant}>
                  Cấp quyền
                </Button>
              </>
            )}
          </div>
        }
      />

      {conflictCount > 0 && (
        <div className="page-alert">
          <Alert tone="warning" title={`Phát hiện ${conflictCount} quyền bị trùng lặp dữ liệu`}>
            Cùng một nhân viên và dự án đang có nhiều bản ghi với mức quyền khác nhau, nên không xác định được mức đang áp dụng. Giao diện hiển thị mức cao nhất để cảnh báo rủi ro. Khởi động lại dịch vụ API để migration tự dọn dữ liệu trùng.
          </Alert>
        </div>
      )}

      <div className="view-switch">
        <Segmented<View>
          label="Chế độ xem"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'Danh sách', icon: 'list' },
            { value: 'matrix', label: 'Ma trận', icon: 'grid' },
          ]}
        />
      </div>

      {view === 'list' ? (
        <Card>
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Tìm nhân viên, dự án..." />
            <FilterButton chips={chips} onReset={() => setFilters(noFilters)}>
              <Field label="Nhân viên">
                <Combobox options={userOptions} value={filters.userId} onChange={(value) => setFilters((f) => ({ ...f, userId: value }))} placeholder="Tất cả nhân viên" clearable />
              </Field>
              <Field label="Dự án">
                <Combobox options={projectOptions} value={filters.projectId} onChange={(value) => setFilters((f) => ({ ...f, projectId: value }))} placeholder="Tất cả dự án" clearable />
              </Field>
              <Field label="Mức quyền">
                <Select value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
                  <option value="">Tất cả mức quyền</option>
                  {LEVEL_ORDER.map((level) => (
                    <option key={level} value={level}>
                      {LEVELS[level].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Checkbox label="Hiện cả quyền đã thu hồi" checked={filters.showRevoked} onChange={(value) => setFilters((f) => ({ ...f, showRevoked: value }))} />
            </FilterButton>
            <span className="toolbar-spacer" />
            <ResultCount count={rows.length} unit="quyền" />
          </Toolbar>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(e) => e.key}
            loading={loading}
            resetKey={`${query}|${JSON.stringify(filters)}`}
            minWidth={860}
            defaultSort={{ key: 'project', dir: 'asc' }}
            empty={
              filtered ? (
                <EmptyState title="Không có quyền phù hợp" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
              ) : (
                <EmptyState
                  icon="shield"
                  title="Chưa cấp quyền nào"
                  description="Cấp quyền để nhân viên truy cập thư mục dự án trên File Server."
                  action={
                    canManage && (
                      <Button variant="primary" icon="plus" onClick={openGrant}>
                        Cấp quyền
                      </Button>
                    )
                  }
                />
              )
            }
          />
        </Card>
      ) : (
        <PermissionMatrix users={users.data} projects={projects.data} companies={companies.data} entries={entries} loading={loading} readOnly={!canManage} onSet={setLevel} />
      )}

      <GrantModal
        open={grant.open}
        initial={grant.initial}
        users={users.data}
        projects={projects.data}
        entries={entries}
        onClose={() => setGrant((g) => ({ ...g, open: false }))}
        onSaved={permissions.reload}
      />
      <ImportModal
        open={importOpen}
        companies={companies.data}
        onClose={() => setImportOpen(false)}
        onSuccess={() => permissions.reload()}
      />
    </>
  );
}

type MatrixProps = {
  users: User[];
  projects: Project[];
  companies: Company[];
  entries: PermissionEntry[];
  loading: boolean;
  readOnly: boolean;
  onSet: (user: User, project: Project, level: string) => Promise<void>;
};

/** Bảng Nhân viên × Dự án của một công ty; bấm vào ô để đổi mức quyền. */
function PermissionMatrix({ users, projects, companies, entries, loading, readOnly, onSet }: MatrixProps) {
  const [companyId, setCompanyId] = useState('');
  const [query, setQuery] = useState('');
  const [onlyWithAccess, setOnlyWithAccess] = useState(false);
  const [picker, setPicker] = useState<{ user: User; project: Project } | null>(null);
  const [saving, setSaving] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const activeCompany = companyId || companies[0]?.id || '';
  const columns = useMemo(() => projects.filter((p) => p.company_id === activeCompany).sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })), [projects, activeCompany]);
  const entryMap = useMemo(() => new Map(entries.filter((e) => !e.resource_id).map((e) => [e.key, e])), [entries]);

  const rows = useMemo(() => {
    const projectIds = new Set(columns.map((p) => p.id));
    const withAccess = new Set(entries.filter((e) => projectIds.has(e.project_id) && hasAccess(e)).map((e) => e.user_id));
    return users
      .filter((u) => {
        const related = withAccess.has(u.id);
        if (onlyWithAccess && !related) return false;
        // Nhân viên đang làm của công ty, cộng với bất kỳ ai (kể cả đã nghỉ) đang có quyền vào dự án của công ty.
        if (!related && !(u.status === 'ACTIVE' && u.company_id === activeCompany)) return false;
        return matches(query, u.full_name, u.username, u.employee_code);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  }, [users, entries, columns, activeCompany, onlyWithAccess, query]);

  // Cho phép lăn chuột dọc bên trong bảng sẽ tự động cuộn ngang trái/phải
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const atLeft = el.scrollLeft <= 0 && e.deltaY < 0;
        const atRight = el.scrollLeft >= maxScroll - 2 && e.deltaY > 0;

        if (!atLeft && !atRight) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [columns.length, rows.length]);

  const current = picker ? entryMap.get(entryKey(picker.user.id, picker.project.id)) : undefined;

  const choose = async (level: string) => {
    if (!picker) return;
    setSaving(true);
    await onSet(picker.user, picker.project, level);
    setSaving(false);
    setPicker(null);
  };

  return (
    <Card>
      <Toolbar>
        <Select className="control-compact" aria-label="Công ty" value={activeCompany} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <SearchInput value={query} onChange={setQuery} placeholder="Tìm nhân viên..." />
        <Checkbox label="Chỉ người đã có quyền" checked={onlyWithAccess} onChange={setOnlyWithAccess} />
        <span className="toolbar-spacer" />
        <ResultCount count={rows.length} unit="nhân viên" />
      </Toolbar>

      {loading ? (
        <div className="card-body">
          <span className="skeleton" />
        </div>
      ) : !columns.length ? (
        <EmptyState icon="folder" title="Công ty chưa có dự án" description="Thêm dự án cho công ty này ở trang Dự án để bắt đầu phân quyền." />
      ) : !rows.length ? (
        <EmptyState title="Không có nhân viên phù hợp" description="Thử đổi từ khoá hoặc bỏ tuỳ chọn lọc." />
      ) : (
        <div className="table-scroll" ref={tableScrollRef}>
          <table className="matrix">
            <thead>
              <tr>
                <th className="matrix-user">Nhân viên</th>
                {columns.map((p) => {
                  const pCode = fixVietnameseEncoding(p.code);
                  const pName = fixVietnameseEncoding(p.name);
                  const title = pName || pCode;
                  const tooltip = pCode && pName && pCode !== pName ? `${pCode} · ${pName}` : title;
                  return (
                    <th key={p.id} title={tooltip}>
                      <span className="matrix-col-title">{title}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <th scope="row" className="matrix-user">
                    <Person
                      name={fixVietnameseEncoding(u.full_name)}
                      size="sm"
                      sub={u.status === 'ACTIVE' ? u.employee_code : labelOf(USER_STATUS, u.status).label}
                    />
                  </th>
                  {columns.map((p) => {
                    const entry = entryMap.get(entryKey(u.id, p.id));
                    const label = entry ? (entry.conflict ? 'Xung đột dữ liệu' : LEVELS[entry.level]?.label) : 'Chưa cấp quyền';
                    return (
                      <td key={p.id}>
                        {readOnly ? (
                          <span className="matrix-cell is-readonly" title={label} aria-label={`${fixVietnameseEncoding(u.full_name)}, ${fixVietnameseEncoding(p.code)}: ${label}`}>
                            <LevelLetter level={entry?.level} conflict={entry?.conflict} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`matrix-cell${picker?.user.id === u.id && picker.project.id === p.id ? ' is-open' : ''}`}
                            aria-label={`${fixVietnameseEncoding(u.full_name)}, ${fixVietnameseEncoding(p.code)}: ${label}. Bấm để đổi.`}
                            title={label}
                            onClick={(event) => {
                              anchorRef.current = event.currentTarget;
                              setPicker({ user: u, project: p });
                            }}
                          >
                            <LevelLetter level={entry?.level} conflict={entry?.conflict} />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="matrix-legend">
        {LEVEL_ORDER.map((level) => (
          <span key={level}>
            <LevelLetter level={level} />
            {LEVELS[level].label}
          </span>
        ))}
        <span>
          <LevelLetter />
          Chưa cấp quyền
        </span>
        <span>
          <LevelLetter conflict />
          Xung đột dữ liệu
        </span>
      </div>

      <Popover anchor={anchorRef} open={!!picker} onClose={() => !saving && setPicker(null)} className="menu level-menu" role="menu" label="Chọn mức quyền">
        {picker && (
          <>
            <div className="level-menu-head">
              <strong>{picker.user.full_name}</strong>
              <span>
                {picker.project.code} · {picker.project.name}
              </span>
            </div>
            {LEVEL_ORDER.map((level) => {
              const checked = !!current && !current.conflict && current.level === level;
              return (
                <button key={level} type="button" role="menuitemradio" aria-checked={checked} className="menu-item level-menu-item" disabled={saving} onClick={() => choose(level)}>
                  <LevelLetter level={level} />
                  <span className="level-menu-text">
                    <strong>{LEVELS[level].label}</strong>
                    <small>{LEVELS[level].description}</small>
                  </span>
                  {checked && <Icon name="check" size={16} />}
                </button>
              );
            })}
          </>
        )}
      </Popover>
    </Card>
  );
}

type GrantModalProps = {
  open: boolean;
  initial: GrantInitial;
  users: User[];
  projects: Project[];
  entries: PermissionEntry[];
  onClose: () => void;
  onSaved: () => void;
};

function GrantModal({ open, initial, users, projects, entries, onClose, onSaved }: GrantModalProps) {
  const toast = useToast();
  const form = useForm({ user_id: '', project_id: '', level: 'READ' });
  const { values, set, errors, busy, reset } = form;
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  useEffect(() => {
    if (open) {
      reset({ user_id: initial.user_id ?? '', project_id: initial.project_id ?? '', level: initial.level ?? 'READ' });
      setSelectedResourceId(initial.resource_id ?? '');
    }
  }, [open, initial, reset]);

  useEffect(() => {
    if (values.project_id) {
      api<{ data: Resource[] }>(`/projects/${values.project_id}/resources`)
        .then((res) => setResources(res.data || []))
        .catch(() => setResources([]));
    } else {
      setResources([]);
    }
  }, [values.project_id]);

  const userOptions = useMemo<Option[]>(
    () =>
      users
        .filter((u) => u.status === 'ACTIVE' || u.id === initial.user_id)
        .map((u) => ({ value: u.id, label: u.full_name, description: `${u.employee_code} · ${u.company_name}${u.department_name ? ` · ${u.department_name}` : ''}`, keywords: `${u.username} ${u.email}` })),
    [users, initial.user_id],
  );
  const projectOptions = useMemo<Option[]>(() => projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, description: p.company_name })), [projects]);

  const resourceId = initial.resource_id !== undefined ? initial.resource_id : (selectedResourceId || null);
  const existing = entries.find((e) => e.user_id === values.user_id && e.project_id === values.project_id && e.resource_id === resourceId);
  const user = users.find((u) => u.id === values.user_id);
  const project = projects.find((p) => p.id === values.project_id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = form.validate({
      user_id: !values.user_id && 'Vui lòng chọn nhân viên',
      project_id: !values.project_id && 'Vui lòng chọn dự án',
    });
    if (!valid) return;
    form.setBusy(true);
    try {
      await api('/permissions', { method: 'POST', body: JSON.stringify({ user_id: values.user_id, project_id: values.project_id, resource_id: resourceId, level: values.level }) });
      toast.success('Đã lưu quyền truy cập', `${user?.full_name ?? 'Nhân viên'} · ${project?.code ?? 'dự án'}: ${LEVELS[values.level].label}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Không lưu được quyền', errorMessage(err));
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      icon={<Icon name="shield" size={22} />}
      title={initial.locked ? 'Đổi mức quyền' : 'Cấp quyền truy cập'}
      description={initial.locked && user && project ? `${user.full_name} · ${project.code} · ${project.name}` : 'Chọn nhân viên, dự án và mức quyền phù hợp.'}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" loading={busy}>
            Lưu quyền
          </Button>
        </>
      }
    >
      <div className="form-grid form-grid-single">
        {!initial.locked && (
          <>
            <Field label="Nhân viên" required error={errors.user_id}>
              <Combobox options={userOptions} value={values.user_id} onChange={(value) => set('user_id', value)} placeholder="Tìm theo tên, mã nhân viên, tên đăng nhập..." />
            </Field>
            <Field label="Dự án" required error={errors.project_id}>
              <Combobox options={projectOptions} value={values.project_id} onChange={(value) => set('project_id', value)} placeholder="Tìm theo mã hoặc tên dự án..." />
            </Field>
            {values.project_id && (
              <Field label="Phạm vi cấp quyền (Thư mục)" hint={resources.length ? undefined : 'Dự án chưa có thư mục con, mặc định cấp toàn dự án'}>
                <Select value={selectedResourceId} onChange={(e) => setSelectedResourceId(e.target.value)}>
                  <option value="">📁 Toàn bộ dự án (Thư mục gốc)</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      📂 {r.path || r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
        {existing && !initial.locked && (
          <Alert tone={existing.conflict ? 'warning' : 'info'}>
            {existing.conflict ? (
              <>Cặp nhân viên – dự án này đang có nhiều bản ghi trùng nhau ({existing.levels.map((l) => LEVELS[l]?.label ?? l).join(', ')}).</>
            ) : (
              <>
                Nhân viên đang có quyền <strong>{LEVELS[existing.level]?.label}</strong> với phạm vi này. Lưu sẽ đổi sang mức mới.
              </>
            )}
          </Alert>
        )}
        <Field label="Mức quyền" required>
          <LevelPicker value={values.level} onChange={(level) => set('level', level)} />
        </Field>
      </div>
    </Modal>
  );
}
