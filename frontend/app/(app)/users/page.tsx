'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { byId, clearQuery, labelOf, matches, readQuery, ROLE_ORDER, ROLES, USER_STATUS } from '@/lib/format';
import { useForm, useList } from '@/lib/hooks';
import { groupPermissions, hasAccess, revokeEntries, type PermissionEntry } from '@/lib/permissions';
import type { Company, Department, Permission, Project, User } from '@/lib/types';
import { useCanManage, useMe } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Alert, Card, EmptyState, LabelBadge, PageHeader, Person } from '@/components/ui/Display';
import { Checkbox, Combobox, Field, Input, Select, Textarea, type Option } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Toolbar, type Chip } from '@/components/ui/Toolbar';

type Filters = { status: string; companyId: string; departmentId: string };
const noFilters: Filters = { status: '', companyId: '', departmentId: '' };

export default function UsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const me = useMe();
  const canManage = useCanManage();
  const users = useList<User>('/users');
  const companies = useList<Company>('/companies');
  const departments = useList<Department>('/departments');
  const projects = useList<Project>('/projects');
  const permissions = useList<Permission>('/permissions');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [editor, setEditor] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [resign, setResign] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  useEffect(() => {
    if (readQuery('new')) setEditor({ open: true, user: null });
    clearQuery();
  }, []);

  const companyById = useMemo(() => byId(companies.data), [companies.data]);
  const departmentById = useMemo(() => byId(departments.data), [departments.data]);
  const accessByUser = useMemo(() => {
    const map = new Map<string, PermissionEntry[]>();
    groupPermissions(permissions.data)
      .filter(hasAccess)
      .forEach((entry) => map.set(entry.user_id, [...(map.get(entry.user_id) ?? []), entry]));
    return map;
  }, [permissions.data]);

  const rows = useMemo(
    () =>
      users.data.filter(
        (u) =>
          (!filters.status || u.status === filters.status) &&
          (!filters.companyId || u.company_id === filters.companyId) &&
          (!filters.departmentId || u.department_id === filters.departmentId) &&
          matches(query, u.full_name, u.employee_code, u.username, u.email, u.phone),
      ),
    [users.data, filters, query],
  );

  const chips = [
    filters.status && { key: 'status', label: labelOf(USER_STATUS, filters.status).label, onRemove: () => setFilters((f) => ({ ...f, status: '' })) },
    filters.companyId && { key: 'company', label: companyById.get(filters.companyId)?.name ?? 'Công ty', onRemove: () => setFilters((f) => ({ ...f, companyId: '', departmentId: '' })) },
    filters.departmentId && { key: 'department', label: departmentById.get(filters.departmentId)?.name ?? 'Phòng ban', onRemove: () => setFilters((f) => ({ ...f, departmentId: '' })) },
  ].filter((chip): chip is Chip => !!chip);

  const remove = async (user: User) => {
    const ok = await confirm({
      title: `Xoá nhân viên "${user.full_name}"?`,
      description: 'Tài khoản sẽ bị vô hiệu hoá và ẩn khỏi danh sách. Lịch sử hoạt động vẫn được giữ lại.',
      confirmText: 'Xoá nhân viên',
    });
    if (!ok) return;
    try {
      await api(`/users/${user.id}`, { method: 'DELETE' });
      toast.success('Đã xoá nhân viên', user.full_name);
      users.reload();
    } catch (err) {
      toast.error('Không xoá được nhân viên', errorMessage(err));
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Nhân viên',
      sort: (u) => u.full_name,
      render: (u) => <Person name={u.full_name} sub={`${u.employee_code} · ${u.username}`} />,
    },
    {
      key: 'org',
      header: 'Công ty / Phòng ban',
      sort: (u) => `${u.company_name} ${u.department_name ?? ''}`,
      render: (u) => (
        <span className="cell-stack">
          <span>{u.company_name}</span>
          <span className="cell-sub">{u.department_name ?? 'Chưa có phòng ban'}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Vai trò', sort: (u) => ROLE_ORDER.indexOf(u.role), render: (u) => <LabelBadge value={labelOf(ROLES, u.role)} /> },
    {
      key: 'access',
      header: 'Quyền',
      sort: (u) => accessByUser.get(u.id)?.length ?? 0,
      render: (u) => {
        const count = accessByUser.get(u.id)?.length ?? 0;
        if (!count) return <span className="muted">—</span>;
        return (
          <Link className={`link${u.status !== 'ACTIVE' ? ' link-danger' : ''}`} href={`/permissions?user=${u.id}`}>
            {count} dự án
          </Link>
        );
      },
    },
    { key: 'status', header: 'Trạng thái', sort: (u) => u.status, render: (u) => <LabelBadge value={labelOf(USER_STATUS, u.status)} dot /> },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (u) => {
        const self = me?.id === u.id;
        // Tài khoản Quản trị cấp cao chỉ Quản trị cấp cao khác được thay đổi.
        const editable = canManage && (u.role !== 'SUPER_ADMIN' || me?.role === 'SUPER_ADMIN');
        return (
          <RowMenu
            label={`Thao tác với ${u.full_name}`}
            items={[
              { label: 'Sửa thông tin', icon: 'pencil', hidden: !editable, onSelect: () => setEditor({ open: true, user: u }) },
              { label: 'Xem quyền truy cập', icon: 'shield', onSelect: () => router.push(`/permissions?user=${u.id}`) },
              { label: 'Cho nghỉ việc', icon: 'user-x', hidden: !editable || u.status !== 'ACTIVE' || self, onSelect: () => setResign({ open: true, user: u }) },
              // "admin" là tài khoản quản trị mặc định (ADMIN_USERNAME), API không cho xoá.
              { label: 'Xoá nhân viên', icon: 'trash', danger: true, hidden: !editable || u.username === 'admin' || self, onSelect: () => remove(u) },
            ]}
          />
        );
      },
    },
  ];

  const openCreate = () => setEditor({ open: true, user: null });
  const filtered = !!(query || chips.length);
  const companyDepartments = departments.data.filter((d) => d.company_id === filters.companyId);

  return (
    <>
      <PageHeader
        eyebrow="Tổ chức"
        title="Nhân viên"
        description="Hồ sơ nhân sự, tài khoản đăng nhập và vòng đời truy cập."
        actions={
          canManage && (
            <Button variant="primary" icon="user-plus" onClick={openCreate}>
              Thêm nhân viên
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm tên, mã NV, tên đăng nhập, email..." />
          <FilterButton chips={chips} onReset={() => setFilters(noFilters)}>
            <Field label="Trạng thái">
              <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(USER_STATUS).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Công ty">
              <Select value={filters.companyId} onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value, departmentId: '' }))}>
                <option value="">Tất cả công ty</option>
                {companies.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Phòng ban" hint={filters.companyId ? undefined : 'Chọn công ty trước'}>
              <Select value={filters.departmentId} disabled={!filters.companyId} onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}>
                <option value="">Tất cả phòng ban</option>
                {companyDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FilterButton>
          <span className="toolbar-spacer" />
          <ResultCount count={rows.length} unit="nhân viên" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={users.loading}
          resetKey={`${query}|${JSON.stringify(filters)}`}
          minWidth={860}
          defaultSort={{ key: 'name', dir: 'asc' }}
          empty={
            filtered ? (
              <EmptyState title="Không tìm thấy nhân viên" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
            ) : (
              <EmptyState
                icon="users"
                title="Chưa có nhân viên"
                description="Thêm nhân viên để cấp tài khoản và phân quyền truy cập dự án."
                action={
                  canManage && (
                    <Button variant="primary" icon="user-plus" onClick={openCreate}>
                      Thêm nhân viên
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>

      <UserModal
        open={editor.open}
        user={editor.user}
        companies={companies.data}
        departments={departments.data}
        defaultCompanyId={filters.companyId}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSaved={users.reload}
      />
      <ResignModal
        open={resign.open}
        user={resign.user}
        users={users.data}
        projects={projects.data}
        entries={resign.user ? accessByUser.get(resign.user.id) ?? [] : []}
        onClose={() => setResign((r) => ({ ...r, open: false }))}
        onDone={() => {
          users.reload();
          permissions.reload();
        }}
      />
    </>
  );
}

type UserForm = {
  full_name: string;
  employee_code: string;
  phone: string;
  email: string;
  company_id: string;
  department_id: string;
  username: string;
  role: string;
  password: string;
  notes: string;
};

const emptyUser: UserForm = { full_name: '', employee_code: '', phone: '', email: '', company_id: '', department_id: '', username: '', role: 'USER', password: '', notes: '' };

type UserModalProps = {
  open: boolean;
  user: User | null;
  companies: Company[];
  departments: Department[];
  defaultCompanyId: string;
  onClose: () => void;
  onSaved: () => void;
};

function UserModal({ open, user, companies, departments, defaultCompanyId, onClose, onSaved }: UserModalProps) {
  const toast = useToast();
  const me = useMe();
  const form = useForm<UserForm>(emptyUser);
  const isSelf = !!user && me?.id === user.id;
  // Chỉ Quản trị cấp cao mới gán được vai trò Quản trị cấp cao.
  const roleOptions = ROLE_ORDER.filter((role) => role !== 'SUPER_ADMIN' || me?.role === 'SUPER_ADMIN');
  const { values, set, errors, busy, reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            full_name: user.full_name,
            employee_code: user.employee_code,
            phone: user.phone ?? '',
            email: user.email ?? '',
            company_id: user.company_id,
            department_id: user.department_id ?? '',
            username: user.username,
            role: user.role,
            password: '',
            notes: user.notes ?? '',
          }
        : { ...emptyUser, company_id: defaultCompanyId },
    );
    // Chỉ khởi tạo lại khi mở popup (không theo dõi bộ lọc công ty đang chọn).
  }, [open, user, reset]);

  const companyDepartments = departments.filter((d) => d.company_id === values.company_id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const username = values.username.trim();
    const email = values.email.trim();
    const valid = form.validate({
      full_name: !values.full_name.trim() && 'Vui lòng nhập họ và tên',
      employee_code: !values.employee_code.trim() && 'Vui lòng nhập mã nhân viên',
      email: !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && 'Email không đúng định dạng',
      company_id: !values.company_id && 'Vui lòng chọn công ty',
      username: !username ? 'Vui lòng nhập tên đăng nhập' : /\s/.test(username) && username !== user?.username && 'Tên đăng nhập không được chứa khoảng trắng',
      password: !user && (!values.password ? 'Vui lòng đặt mật khẩu ban đầu' : values.password.length < 8 && 'Mật khẩu cần tối thiểu 8 ký tự'),
    });
    if (!valid) return;
    form.setBusy(true);
    const payload = {
      employee_code: values.employee_code.trim(),
      username,
      full_name: values.full_name.trim(),
      email,
      phone: values.phone.trim(),
      company_id: values.company_id,
      department_id: values.department_id || null,
      role: values.role,
      notes: values.notes.trim(),
    };
    try {
      if (user) {
        // API cập nhật đặt lại trạng thái thành ACTIVE nếu không gửi kèm: giữ nguyên trạng thái hiện tại.
        await api(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ ...payload, status: user.status }) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify({ ...payload, password: values.password }) });
      }
      toast.success(user ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên', payload.full_name);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(user ? 'Không cập nhật được nhân viên' : 'Không thêm được nhân viên', errorMessage(err));
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      icon={<Icon name={user ? 'pencil' : 'user-plus'} size={22} />}
      title={user ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
      description={user ? `${user.full_name} · ${user.employee_code}` : 'Tạo hồ sơ nhân sự kèm tài khoản đăng nhập hệ thống.'}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" loading={busy}>
            {user ? 'Lưu thay đổi' : 'Thêm nhân viên'}
          </Button>
        </>
      }
    >
      <section className="form-section">
        <h3 className="form-section-title">Thông tin nhân viên</h3>
        <div className="form-grid">
          <Field label="Họ và tên" required error={errors.full_name} wide>
            <Input value={values.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="VD: Nguyễn Văn An" autoComplete="off" />
          </Field>
          <Field label="Mã nhân viên" required error={errors.employee_code}>
            <Input value={values.employee_code} onChange={(e) => set('employee_code', e.target.value)} placeholder="VD: NV-0012" autoComplete="off" />
          </Field>
          <Field label="Số điện thoại">
            <Input type="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="VD: 0901 234 567" autoComplete="off" />
          </Field>
          <Field label="Email" error={errors.email} wide>
            <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} placeholder="ten@congty.vn" autoComplete="off" />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Tổ chức</h3>
        <div className="form-grid">
          <Field label="Công ty" required error={errors.company_id}>
            <Select
              value={values.company_id}
              onChange={(e) => {
                set('company_id', e.target.value);
                set('department_id', '');
              }}
            >
              <option value="">Chọn công ty</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phòng ban" hint={!values.company_id ? 'Chọn công ty trước' : !companyDepartments.length ? 'Công ty chưa có phòng ban nào' : undefined}>
            <Select value={values.department_id} disabled={!values.company_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">Không thuộc phòng ban</option>
              {companyDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Tài khoản đăng nhập</h3>
        <div className="form-grid">
          <Field label="Tên đăng nhập" required error={errors.username}>
            <Input value={values.username} onChange={(e) => set('username', e.target.value)} placeholder="VD: an.nguyen" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Vai trò" hint={isSelf ? 'Bạn không thể tự đổi vai trò của mình.' : undefined}>
            <Select value={values.role} disabled={isSelf} onChange={(e) => set('role', e.target.value)}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {ROLES[role].label}
                </option>
              ))}
            </Select>
          </Field>
          {!user && (
            <Field label="Mật khẩu ban đầu" required error={errors.password} hint="Tối thiểu 8 ký tự. Gửi cho nhân viên qua kênh an toàn." wide>
              <Input type="password" value={values.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
            </Field>
          )}
          <Field label="Ghi chú" wide>
            <Textarea value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Thông tin bổ sung (không bắt buộc)" />
          </Field>
        </div>
      </section>
    </Modal>
  );
}

type ResignModalProps = {
  open: boolean;
  user: User | null;
  users: User[];
  projects: Project[];
  entries: PermissionEntry[];
  onClose: () => void;
  onDone: () => void;
};

function ResignModal({ open, user, users, projects, entries, onClose, onDone }: ResignModalProps) {
  const toast = useToast();
  const [replacement, setReplacement] = useState('');
  const [note, setNote] = useState('');
  const [revoke, setRevoke] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setReplacement('');
    // API ghi đè ghi chú hiện có bằng ghi chú nghỉ việc, nên điền sẵn để không mất nội dung cũ.
    setNote(user.notes ?? '');
    setRevoke(true);
  }, [open, user]);

  const options = useMemo<Option[]>(
    () =>
      users
        .filter((u) => u.status === 'ACTIVE' && u.id !== user?.id)
        .map((u) => ({ value: u.id, label: u.full_name, description: `${u.employee_code} · ${u.company_name}${u.department_name ? ` · ${u.department_name}` : ''}`, keywords: `${u.username} ${u.email}` })),
    [users, user],
  );

  const projectCodes = useMemo(() => {
    const codes = entries.map((e) => projects.find((p) => p.id === e.project_id)?.code ?? e.project_name);
    return codes.length > 3 ? `${codes.slice(0, 3).join(', ')} và ${codes.length - 3} dự án khác` : codes.join(', ');
  }, [entries, projects]);

  if (!user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/users/${user.id}/resign`, { method: 'POST', body: JSON.stringify({ replacement_user_id: replacement || null, note: note.trim() }) });
    } catch (err) {
      toast.error('Không cập nhật được trạng thái nghỉ việc', errorMessage(err));
      setBusy(false);
      return;
    }
    let revoked = 0;
    if (revoke && entries.length) {
      const result = await revokeEntries(entries);
      revoked = result.done;
      if (result.failed) toast.warning('Chưa thu hồi hết quyền', `${result.failed}/${entries.length} quyền chưa thu hồi được, hãy kiểm tra ở trang Phân quyền.`);
    }
    toast.success('Đã cho nghỉ việc', revoked ? `${user.full_name} · đã thu hồi ${revoked} quyền truy cập` : user.full_name);
    setBusy(false);
    onDone();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      tone="red"
      icon={<Icon name="user-x" size={22} />}
      title="Cho nhân viên nghỉ việc"
      description="Tài khoản chuyển sang trạng thái Đã nghỉ việc kể từ hôm nay."
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="danger" type="submit" loading={busy}>
            Xác nhận nghỉ việc
          </Button>
        </>
      }
    >
      <div className="summary-card">
        <Person name={user.full_name} sub={`${user.employee_code} · ${user.company_name}${user.department_name ? ` · ${user.department_name}` : ''}`} />
        <LabelBadge value={labelOf(ROLES, user.role)} />
      </div>
      <div className="form-grid form-grid-single">
        <Field label="Người thay thế" hint="Người tiếp nhận công việc, có thể để trống.">
          <Combobox options={options} value={replacement} onChange={setReplacement} placeholder="Tìm theo tên, mã nhân viên..." clearable />
        </Field>
        <Field label="Ghi chú nghỉ việc" hint="Nội dung này sẽ thay cho ghi chú hiện tại của nhân viên.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Lý do, bàn giao, thiết bị cần thu hồi..." />
        </Field>
        {entries.length ? (
          <div className="revoke-box">
            <Checkbox label={`Thu hồi ngay ${entries.length} quyền truy cập dự án`} checked={revoke} onChange={setRevoke} />
            <p className="field-hint">{projectCodes}</p>
            {!revoke && <Alert tone="warning">Nhân viên sẽ vẫn giữ quyền vào các dự án này sau khi nghỉ việc.</Alert>}
          </div>
        ) : (
          <Alert>Nhân viên hiện không có quyền truy cập dự án nào.</Alert>
        )}
      </div>
    </Modal>
  );
}
