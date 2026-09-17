'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { labelOf, matches, RECORD_STATUS } from '@/lib/format';
import { useForm, useList } from '@/lib/hooks';
import { groupPermissions, hasAccess } from '@/lib/permissions';
import type { Company, Permission, Project } from '@/lib/types';
import { downloadExcel } from '@/lib/export';
import { useCanManage } from '@/components/AppShell';
import { FolderModal } from '@/components/FolderModal';
import { ProjectMembersModal } from '@/components/ProjectMembersModal';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Confirm';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card, EmptyState, LabelBadge, PageHeader } from '@/components/ui/Display';
import { Field, Input, Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { RowMenu } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toast';
import { FilterButton, ResultCount, SearchInput, Toolbar, type Chip } from '@/components/ui/Toolbar';

export default function ProjectsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const canManage = useCanManage();
  const projects = useList<Project>('/projects');
  const companies = useList<Company>('/companies');
  const permissions = useList<Permission>('/permissions');
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [folderModal, setFolderModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [memberModal, setMemberModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [exporting, setExporting] = useState(false);

  const accessCount = useMemo(() => {
    const map = new Map<string, number>();
    groupPermissions(permissions.data)
      .filter(hasAccess)
      .forEach((entry) => map.set(entry.project_id, (map.get(entry.project_id) ?? 0) + 1));
    return map;
  }, [permissions.data]);

  const rows = useMemo(
    () => projects.data.filter((p) => (!companyId || p.company_id === companyId) && matches(query, p.code, p.name, p.company_name, p.folder_path)),
    [projects.data, companyId, query],
  );

  const chips: Chip[] = companyId
    ? [{ key: 'company', label: companies.data.find((c) => c.id === companyId)?.name ?? 'Công ty', onRemove: () => setCompanyId('') }]
    : [];

  const remove = async (project: Project) => {
    const ok = await confirm({
      title: `Xoá dự án "${project.name}"?`,
      description: 'Dự án sẽ bị ẩn khỏi danh sách (xoá mềm). Dữ liệu lịch sử vẫn được giữ lại.',
      confirmText: 'Xoá dự án',
    });
    if (!ok) return;
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      toast.success('Đã xoá dự án', `${project.code} · ${project.name}`);
      projects.reload();
    } catch (err) {
      toast.error('Không xoá được dự án', errorMessage(err));
    }
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Dự án',
      sort: (p) => p.name,
      render: (p) => (
        <span className="cell-stack">
          <strong className="cell-title">{p.name}</strong>
          <span className="cell-sub">
            <span className="code-chip code-chip-sm">{p.code}</span>
          </span>
        </span>
      ),
    },
    { key: 'company', header: 'Công ty', sort: (p) => p.company_name, render: (p) => p.company_name },
    {
      key: 'folder',
      header: 'Thư mục File Server',
      render: (p) =>
        p.folder_path ? (
          <span className="mono truncate" title={p.folder_path}>
            {p.folder_path}
          </span>
        ) : (
          <span className="muted">Chưa khai báo</span>
        ),
    },
    {
      key: 'access',
      header: 'Người có quyền',
      width: 150,
      sort: (p) => accessCount.get(p.id) ?? 0,
      render: (p) => (
        <Link className="link" href={`/permissions?project=${p.id}`}>
          {accessCount.get(p.id) ?? 0} người
        </Link>
      ),
    },
    { key: 'status', header: 'Trạng thái', width: 150, render: (p) => <LabelBadge value={labelOf(RECORD_STATUS, p.status)} dot /> },
    {
      key: 'actions',
      header: '',
      width: 64,
      className: 'col-actions',
      render: (p) => (
        <RowMenu
          label={`Thao tác với ${p.name}`}
          items={[
            { label: 'Thành viên ban dự án', icon: 'users', onSelect: () => setMemberModal({ open: true, project: p }) },
            { label: 'Cây thư mục File Server', icon: 'folder', onSelect: () => setFolderModal({ open: true, project: p }) },
            { label: 'Sửa dự án', icon: 'pencil', hidden: !canManage, onSelect: () => setModal({ open: true, project: p }) },
            { label: 'Xem phân quyền', icon: 'shield', onSelect: () => router.push(`/permissions?project=${p.id}`) },
            { label: 'Xoá dự án', icon: 'trash', danger: true, hidden: !canManage, onSelect: () => remove(p) },
          ]}
        />
      ),
    },
  ];

  const openCreate = () => setModal({ open: true, project: null });
  const filtered = !!(query || companyId);

  return (
    <>
      <PageHeader
        eyebrow="Truy cập"
        title="Dự án"
        description="Dự án gắn với công ty và thư mục trên File Server — đơn vị để cấp quyền truy cập."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              icon="download"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadExcel('/export/projects', 'Danh_sach_du_an.xlsx');
                  toast.success('Đã xuất file Excel thành công');
                } catch (err) {
                  toast.error('Không xuất được file', errorMessage(err));
                } finally {
                  setExporting(false);
                }
              }}
            >
              Xuất Excel
            </Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Thêm dự án
              </Button>
            )}
          </div>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo mã, tên, thư mục..." />
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
          <ResultCount count={rows.length} unit="dự án" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          loading={projects.loading}
          resetKey={`${query}|${companyId}`}
          minWidth={860}
          defaultSort={{ key: 'name', dir: 'asc' }}
          empty={
            filtered ? (
              <EmptyState title="Không tìm thấy dự án" description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc." />
            ) : (
              <EmptyState
                icon="folder"
                title="Chưa có dự án"
                description="Tạo dự án và khai báo thư mục File Server để bắt đầu cấp quyền cho nhân viên."
                action={
                  canManage && (
                    <Button variant="primary" icon="plus" onClick={openCreate}>
                      Thêm dự án
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>
      <ProjectModal
        open={modal.open}
        project={modal.project}
        defaultCompanyId={companyId}
        companies={companies.data}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={projects.reload}
      />
      <ProjectMembersModal
        open={memberModal.open}
        project={memberModal.project}
        onClose={() => setMemberModal({ open: false, project: null })}
        onUpdated={projects.reload}
      />
      <FolderModal
        open={folderModal.open}
        project={folderModal.project}
        onClose={() => setFolderModal({ open: false, project: null })}
        onUpdated={projects.reload}
      />
    </>
  );
}

type ProjectModalProps = {
  open: boolean;
  project: Project | null;
  defaultCompanyId: string;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
};

function ProjectModal({ open, project, defaultCompanyId, companies, onClose, onSaved }: ProjectModalProps) {
  const toast = useToast();
  const form = useForm({ company_id: '', code: '', name: '', folder_path: '' });
  const { values, set, errors, busy, reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      project
        ? { company_id: project.company_id, code: project.code, name: project.name, folder_path: project.folder_path ?? '' }
        : { company_id: defaultCompanyId, code: '', name: '', folder_path: '' },
    );
    // Chỉ khởi tạo lại khi mở popup (không theo dõi bộ lọc công ty đang chọn).
  }, [open, project, reset]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = form.validate({
      company_id: !values.company_id && 'Vui lòng chọn công ty',
      code: !values.code.trim() && 'Vui lòng nhập mã dự án',
      name: !values.name.trim() && 'Vui lòng nhập tên dự án',
    });
    if (!valid) return;
    form.setBusy(true);
    // API cập nhật ghi đè toàn bộ bản ghi: giữ nguyên trạng thái và ngày bắt đầu/kết thúc hiện có.
    const body = JSON.stringify({
      company_id: values.company_id,
      code: values.code.trim(),
      name: values.name.trim(),
      folder_path: values.folder_path.trim(),
      status: project?.status ?? 'ACTIVE',
      start_date: project?.start_date ?? null,
      end_date: project?.end_date ?? null,
    });
    try {
      if (project) await api(`/projects/${project.id}`, { method: 'PUT', body });
      else await api('/projects', { method: 'POST', body });
      toast.success(project ? 'Đã cập nhật dự án' : 'Đã thêm dự án', `${values.code.trim()} · ${values.name.trim()}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(project ? 'Không cập nhật được dự án' : 'Không thêm được dự án', errorMessage(err));
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      icon={<Icon name="folder" size={22} />}
      title={project ? 'Sửa dự án' : 'Thêm dự án mới'}
      description={project ? `${project.code} · ${project.name}` : 'Mã dự án là duy nhất trong mỗi công ty.'}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" loading={busy}>
            {project ? 'Lưu thay đổi' : 'Thêm dự án'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Công ty" required error={errors.company_id} wide>
          <Select value={values.company_id} onChange={(e) => set('company_id', e.target.value)}>
            <option value="">Chọn công ty</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mã dự án" required error={errors.code}>
          <Input value={values.code} onChange={(e) => set('code', e.target.value)} maxLength={50} placeholder="VD: PRJ-001" />
        </Field>
        <Field label="Tên dự án" required error={errors.name}>
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={200} placeholder="VD: Nhà máy Bình Dương" />
        </Field>
        <Field label="Thư mục File Server" hint="Đường dẫn thư mục gốc của dự án trên máy chủ file." wide>
          <Input className="mono" value={values.folder_path} onChange={(e) => set('folder_path', e.target.value)} placeholder="\\fileserver\projects\PRJ-001" />
        </Field>
      </div>
    </Modal>
  );
}
