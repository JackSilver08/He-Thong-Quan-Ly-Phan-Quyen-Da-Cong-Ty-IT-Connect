'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Project, Resource } from '@/lib/types';
import { useCanManage } from './AppShell';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { EmptyState } from './ui/Display';
import { Field, Input, Select } from './ui/Form';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

type FolderModalProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function FolderModal({ open, project, onClose, onUpdated }: FolderModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCanManage();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [creating, setCreating] = useState(false);

  const loadResources = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await api<{ data: Resource[] }>(`/projects/${project.id}/resources`);
      setResources(res.data || []);
    } catch (err) {
      toast.error('Không tải được danh sách thư mục', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && project) {
      setName('');
      setParentId('');
      loadResources();
    }
  }, [open, project]);

  const parentOptions = useMemo(() => {
    return resources.filter((r) => r.resource_type === 'FOLDER');
  }, [resources]);

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) {
      toast.warning('Thiếu tên thư mục', 'Vui lòng nhập tên thư mục cần tạo.');
      return;
    }
    setCreating(true);
    try {
      const parentFolder = resources.find((r) => r.id === parentId);
      const computedPath = parentFolder && parentFolder.path ? `${parentFolder.path}\\${name.trim()}` : name.trim();

      await api(`/projects/${project.id}/resources`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          path: computedPath,
          parent_id: parentId || null,
          resource_type: 'FOLDER',
        }),
      });
      toast.success('Đã tạo thư mục', name.trim());
      setName('');
      setParentId('');
      loadResources();
      onUpdated?.();
    } catch (err) {
      toast.error('Không tạo được thư mục', errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const removeFolder = async (res: Resource) => {
    const ok = await confirm({
      title: `Xóa thư mục "${res.name}"?`,
      description: 'Mọi phân quyền gắn với thư mục này sẽ bị thu hồi. Thao tác không thể hoàn tác.',
      confirmText: 'Xóa thư mục',
    });
    if (!ok) return;
    try {
      await api(`/resources/${res.id}`, { method: 'DELETE' });
      toast.success('Đã xóa thư mục', res.name);
      loadResources();
      onUpdated?.();
    } catch (err) {
      toast.error('Không xóa được thư mục', errorMessage(err));
    }
  };

  if (!project) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Icon name="folder" size={22} />}
      title="Cây thư mục File Server"
      description={`${project.code} · ${project.name} (${project.folder_path || 'Thư mục gốc'})`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Link href={`/permissions?project=${project.id}`} className="link" style={{ fontSize: '13px' }}>
            Xem và phân quyền R/W/X cho dự án này &rarr;
          </Link>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      {/* Create Folder Form */}
      {canManage && (
        <form onSubmit={createFolder} style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Thêm thư mục con mới</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <Field label="Tên thư mục con" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: 01. Ban Giam Doc, 02. Hop Dong..."
              />
            </Field>
            <Field label="Nằm trong thư mục">
              <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Thư mục gốc của dự án</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    📁 {p.path || p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" icon="plus" type="submit" loading={creating} disabled={!name.trim()}>
              Tạo thư mục
            </Button>
          </div>
        </form>
      )}

      {/* Folders List */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <span className="spinner" />
        </div>
      ) : !resources.length ? (
        <EmptyState
          icon="folder"
          title="Chưa khai báo thư mục con nào"
          description="Bạn có thể thêm các thư mục con (ví dụ: Ban giám đốc, Kế toán, Kỹ thuật...) để phân quyền chi tiết cho từng nhóm nhân viên."
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thư mục</th>
                <th>Đường dẫn phân cấp</th>
                <th>Ngày tạo</th>
                {canManage && <th style={{ width: '80px', textAlign: 'right' }}>Xóa</th>}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                        <Icon name="folder" size={18} />
                      </span>
                      <strong>{r.name}</strong>
                    </div>
                  </td>
                  <td>
                    <code className="mono" style={{ fontSize: '12px' }}>
                      {project.folder_path ? `${project.folder_path}\\` : ''}{r.path || r.name}
                    </code>
                  </td>
                  <td>{formatDate(r.created_at)}</td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => removeFolder(r)}
                        title="Xóa thư mục này"
                        aria-label={`Xóa thư mục ${r.name}`}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
