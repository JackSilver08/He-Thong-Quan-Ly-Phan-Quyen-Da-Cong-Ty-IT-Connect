'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { labelOf, matches, RECORD_STATUS } from '@/lib/format';
import { useForm, useList } from '@/lib/hooks';
import type { Company, Project, User } from '@/lib/types';
import { useCanManage } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card, EmptyState, LabelBadge, PageHeader } from '@/components/ui/Display';
import { Field, Input, Textarea } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { ResultCount, SearchInput, Toolbar } from '@/components/ui/Toolbar';

export default function CompaniesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCanManage();
  const companies = useList<Company>('/companies');
  const users = useList<User>('/users');
  const projects = useList<Project>('/projects');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ open: boolean; company: Company | null }>({ open: false, company: null });

  const counts = useMemo(() => {
    const map = new Map<string, { users: number; projects: number }>();
    const get = (id: string) => map.get(id) ?? map.set(id, { users: 0, projects: 0 }).get(id)!;
    users.data.filter((u) => u.status === 'ACTIVE').forEach((u) => get(u.company_id).users++);
    projects.data.forEach((p) => get(p.company_id).projects++);
    return map;
  }, [users.data, projects.data]);

  const rows = useMemo(() => companies.data.filter((c) => matches(query, c.code, c.name, c.description)), [companies.data, query]);

  const remove = async (company: Company) => {
    const ok = await confirm({
      title: `Xoá công ty "${company.name}"?`,
      description: 'Công ty sẽ bị ẩn khỏi hệ thống (xoá mềm). Dữ liệu lịch sử vẫn được giữ lại.',
      confirmText: 'Xoá công ty',
    });
    if (!ok) return;
    try {
      await api(`/companies/${company.id}`, { method: 'DELETE' });
      toast.success('Đã xoá công ty', company.name);
      companies.reload();
    } catch (err) {
      toast.error('Không xoá được công ty', errorMessage(err));
    }
  };

  const allColumns: Column<Company>[] = [
    { key: 'code', header: 'Mã', width: 140, sort: (c) => c.code, render: (c) => <span className="code-chip">{c.code}</span> },
    {
      key: 'name',
      header: 'Công ty',
      sort: (c) => c.name,
      render: (c) => (
        <span className="cell-stack">
          <strong className="cell-title">{c.name}</strong>
          {c.description && <span className="cell-sub clamp-1">{c.description}</span>}
        </span>
      ),
    },
    { key: 'users', header: 'Nhân viên', width: 130, sort: (c) => counts.get(c.id)?.users ?? 0, render: (c) => counts.get(c.id)?.users ?? 0 },
    { key: 'projects', header: 'Dự án', width: 110, sort: (c) => counts.get(c.id)?.projects ?? 0, render: (c) => counts.get(c.id)?.projects ?? 0 },
    { key: 'status', header: 'Trạng thái', width: 150, render: (c) => <LabelBadge value={labelOf(RECORD_STATUS, c.status)} dot /> },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (c) => (
        <RowMenu
          label={`Thao tác với ${c.name}`}
          items={[
            { label: 'Sửa thông tin', icon: 'pencil', onSelect: () => setModal({ open: true, company: c }) },
            { label: 'Xoá công ty', icon: 'trash', danger: true, onSelect: () => remove(c) },
          ]}
        />
      ),
    },
  ];
  const columns = canManage ? allColumns : allColumns.filter((column) => column.key !== 'actions');

  const openCreate = () => setModal({ open: true, company: null });

  return (
    <>
      <PageHeader
        eyebrow="Tổ chức"
        title="Công ty"
        description="Các công ty thành viên dùng chung hệ thống phân quyền."
        actions={
          canManage && (
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Thêm công ty
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo mã, tên hoặc mô tả..." />
          <span className="toolbar-spacer" />
          <ResultCount count={rows.length} unit="công ty" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          loading={companies.loading}
          resetKey={query}
          defaultSort={{ key: 'name', dir: 'asc' }}
          empty={
            query ? (
              <EmptyState title="Không tìm thấy công ty" description={`Không có công ty nào khớp với "${query}".`} />
            ) : (
              <EmptyState
                icon="building"
                title="Chưa có công ty"
                description="Thêm công ty đầu tiên để bắt đầu quản lý phòng ban, nhân viên và dự án."
                action={
                  canManage && (
                    <Button variant="primary" icon="plus" onClick={openCreate}>
                      Thêm công ty
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>
      <CompanyModal
        open={modal.open}
        company={modal.company}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={companies.reload}
      />
    </>
  );
}

const emptyForm = { code: '', name: '', description: '' };

function CompanyModal({ open, company, onClose, onSaved }: { open: boolean; company: Company | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm(emptyForm);
  const { values, set, errors, busy, reset } = form;

  useEffect(() => {
    if (open) reset(company ? { code: company.code, name: company.name, description: company.description ?? '' } : emptyForm);
  }, [open, company, reset]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = form.validate({
      code: !values.code.trim() && 'Vui lòng nhập mã công ty',
      name: !values.name.trim() && 'Vui lòng nhập tên công ty',
    });
    if (!valid) return;
    form.setBusy(true);
    const body = JSON.stringify({ code: values.code.trim(), name: values.name.trim(), description: values.description.trim() });
    try {
      if (company) await api(`/companies/${company.id}`, { method: 'PUT', body });
      else await api('/companies', { method: 'POST', body });
      toast.success(company ? 'Đã cập nhật công ty' : 'Đã thêm công ty', values.name.trim());
      onSaved();
      onClose();
    } catch (err) {
      toast.error(company ? 'Không cập nhật được công ty' : 'Không thêm được công ty', errorMessage(err));
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      icon={<Icon name="building" size={22} />}
      title={company ? 'Sửa thông tin công ty' : 'Thêm công ty mới'}
      description={company ? company.name : 'Mã công ty dùng để nhận diện nhanh trong các danh sách.'}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" loading={busy}>
            {company ? 'Lưu thay đổi' : 'Thêm công ty'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Mã công ty" required error={errors.code}>
          <Input value={values.code} onChange={(e) => set('code', e.target.value)} maxLength={50} placeholder="VD: ITC" />
        </Field>
        <Field label="Tên công ty" required error={errors.name}>
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={200} placeholder="VD: IT Connect" />
        </Field>
        <Field label="Mô tả" wide>
          <Textarea value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Lĩnh vực hoạt động, địa chỉ, ghi chú..." />
        </Field>
      </div>
    </Modal>
  );
}
