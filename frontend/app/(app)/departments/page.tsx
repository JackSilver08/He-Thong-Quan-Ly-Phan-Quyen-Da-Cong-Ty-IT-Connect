'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { byId, matches } from '@/lib/format';
import { useForm, useList } from '@/lib/hooks';
import type { Company, Department, User } from '@/lib/types';
import { useCanManage } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card, EmptyState, PageHeader } from '@/components/ui/Display';
import { Field, Input, Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Toolbar, type Chip } from '@/components/ui/Toolbar';

export default function DepartmentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCanManage();
  const departments = useList<Department>('/departments');
  const companies = useList<Company>('/companies');
  const users = useList<User>('/users');
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [modal, setModal] = useState<{ open: boolean; department: Department | null }>({ open: false, department: null });

  const companyById = useMemo(() => byId(companies.data), [companies.data]);
  const headcount = useMemo(() => {
    const map = new Map<string, number>();
    users.data.forEach((u) => u.department_id && map.set(u.department_id, (map.get(u.department_id) ?? 0) + 1));
    return map;
  }, [users.data]);

  const rows = useMemo(
    () => departments.data.filter((d) => (!companyId || d.company_id === companyId) && matches(query, d.name, companyById.get(d.company_id)?.name)),
    [departments.data, companyId, query, companyById],
  );

  const chips: Chip[] = companyId ? [{ key: 'company', label: companyById.get(companyId)?.name ?? 'Công ty', onRemove: () => setCompanyId('') }] : [];

  const remove = async (department: Department) => {
    const count = headcount.get(department.id) ?? 0;
    if (count > 0) {
      toast.warning('Chưa thể xoá phòng ban', `"${department.name}" đang có ${count} nhân sự. Hãy chuyển họ sang phòng ban khác trước.`);
      return;
    }
    const ok = await confirm({ title: `Xoá phòng ban "${department.name}"?`, description: 'Thao tác này không thể hoàn tác.', confirmText: 'Xoá phòng ban' });
    if (!ok) return;
    try {
      await api(`/departments/${department.id}`, { method: 'DELETE' });
      toast.success('Đã xoá phòng ban', department.name);
      departments.reload();
    } catch (err) {
      toast.error('Không xoá được phòng ban', errorMessage(err));
    }
  };

  const allColumns: Column<Department>[] = [
    { key: 'name', header: 'Phòng ban', sort: (d) => d.name, render: (d) => <strong className="cell-title">{d.name}</strong> },
    {
      key: 'company',
      header: 'Công ty',
      sort: (d) => companyById.get(d.company_id)?.name ?? '',
      render: (d) => {
        const company = companyById.get(d.company_id);
        return company ? (
          <span className="cell-inline">
            <span className="code-chip">{company.code}</span>
            {company.name}
          </span>
        ) : (
          '—'
        );
      },
    },
    { key: 'headcount', header: 'Nhân sự', width: 130, sort: (d) => headcount.get(d.id) ?? 0, render: (d) => headcount.get(d.id) ?? 0 },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (d) => (
        <RowMenu
          label={`Thao tác với ${d.name}`}
          items={[
            { label: 'Sửa phòng ban', icon: 'pencil', onSelect: () => setModal({ open: true, department: d }) },
            { label: 'Xoá phòng ban', icon: 'trash', danger: true, onSelect: () => remove(d) },
          ]}
        />
      ),
    },
  ];
  const columns = canManage ? allColumns : allColumns.filter((column) => column.key !== 'actions');

  const openCreate = () => setModal({ open: true, department: null });
  const filtered = !!(query || companyId);

  return (
    <>
      <PageHeader
        eyebrow="Tổ chức"
        title="Phòng ban"
        description="Cơ cấu phòng ban của từng công ty."
        actions={
          canManage && (
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Thêm phòng ban
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm phòng ban hoặc công ty..." />
          <FilterButton chips={chips} onReset={() => setCompanyId('')}>
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
          </FilterButton>
          <span className="toolbar-spacer" />
          <ResultCount count={rows.length} unit="phòng ban" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          loading={departments.loading}
          resetKey={`${query}|${companyId}`}
          defaultSort={{ key: 'company', dir: 'asc' }}
          empty={
            filtered ? (
              <EmptyState title="Không tìm thấy phòng ban" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
            ) : (
              <EmptyState
                icon="network"
                title="Chưa có phòng ban"
                description="Tạo phòng ban để sắp xếp nhân viên theo cơ cấu tổ chức."
                action={
                  canManage && (
                    <Button variant="primary" icon="plus" onClick={openCreate}>
                      Thêm phòng ban
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>
      <DepartmentModal
        open={modal.open}
        department={modal.department}
        defaultCompanyId={companyId}
        companies={companies.data}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={departments.reload}
      />
    </>
  );
}

type DepartmentModalProps = {
  open: boolean;
  department: Department | null;
  defaultCompanyId: string;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
};

function DepartmentModal({ open, department, defaultCompanyId, companies, onClose, onSaved }: DepartmentModalProps) {
  const toast = useToast();
  const form = useForm({ company_id: '', name: '' });
  const { values, set, errors, busy, reset } = form;

  useEffect(() => {
    if (open) reset(department ? { company_id: department.company_id, name: department.name } : { company_id: defaultCompanyId, name: '' });
    // Chỉ khởi tạo lại khi mở popup (không theo dõi bộ lọc công ty đang chọn).
  }, [open, department, reset]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = form.validate({
      company_id: !values.company_id && 'Vui lòng chọn công ty',
      name: !values.name.trim() && 'Vui lòng nhập tên phòng ban',
    });
    if (!valid) return;
    form.setBusy(true);
    const body = JSON.stringify({ company_id: values.company_id, name: values.name.trim() });
    try {
      if (department) await api(`/departments/${department.id}`, { method: 'PUT', body });
      else await api('/departments', { method: 'POST', body });
      toast.success(department ? 'Đã cập nhật phòng ban' : 'Đã thêm phòng ban', values.name.trim());
      onSaved();
      onClose();
    } catch (err) {
      toast.error(department ? 'Không cập nhật được phòng ban' : 'Không thêm được phòng ban', errorMessage(err));
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      icon={<Icon name="network" size={22} />}
      title={department ? 'Sửa phòng ban' : 'Thêm phòng ban mới'}
      description={department ? department.name : 'Mỗi công ty có danh sách phòng ban riêng.'}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" loading={busy}>
            {department ? 'Lưu thay đổi' : 'Thêm phòng ban'}
          </Button>
        </>
      }
    >
      <div className="form-grid form-grid-single">
        <Field label="Công ty" required error={errors.company_id} hint={department ? 'Không thể chuyển phòng ban sang công ty khác.' : undefined}>
          <Select value={values.company_id} disabled={!!department} onChange={(e) => set('company_id', e.target.value)}>
            <option value="">Chọn công ty</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tên phòng ban" required error={errors.name}>
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={200} placeholder="VD: Phòng Kỹ thuật" />
        </Field>
      </div>
    </Modal>
  );
}
