'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Project, ProjectMember, User } from '@/lib/types';
import { useCanManage } from './AppShell';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { Badge, EmptyState, Person } from './ui/Display';
import { Combobox, Field, Input, Select, type Option } from './ui/Form';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

type ProjectMembersModalProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onUpdated?: () => void;
};

const PROJECT_ROLES = [
  'Chỉ huy trưởng / Giám đốc DA (PM)',
  'Chỉ huy phó / Phó Giám đốc DA',
  'Kỹ sư trưởng / Trưởng ban kỹ thuật',
  'Kỹ sư giám sát',
  'Kế toán công trình',
  'Thành viên ban dự án',
];

export function ProjectMembersModal({ open, project, onClose, onUpdated }: ProjectMembersModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCanManage();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customRole, setCustomRole] = useState('Thành viên ban dự án');
  const [adding, setAdding] = useState(false);

  const loadData = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [mRes, uRes] = await Promise.all([
        api<{ data: ProjectMember[] }>(`/projects/${project.id}/members`),
        api<{ data: User[] }>('/users?status=ACTIVE'),
      ]);
      setMembers(mRes.data || []);
      setUsers(uRes.data || []);
    } catch (err) {
      toast.error('Không tải được danh sách thành viên', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && project) {
      setSelectedUserId('');
      setCustomRole('Thành viên ban dự án');
      loadData();
    }
  }, [open, project]);

  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const userOptions = useMemo<Option[]>(() => {
    return users
      .filter((u) => !memberUserIds.has(u.id))
      .map((u) => ({
        value: u.id,
        label: u.full_name,
        description: `${u.employee_code} · ${u.company_name}`,
        keywords: `${u.username} ${u.email}`,
      }));
  }, [users, memberUserIds]);

  const addMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !selectedUserId) {
      toast.warning('Chưa chọn nhân viên', 'Vui lòng chọn nhân viên để thêm vào dự án.');
      return;
    }
    setAdding(true);
    try {
      await api(`/projects/${project.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId,
          project_role: customRole || 'Thành viên ban dự án',
        }),
      });
      toast.success('Đã thêm thành viên vào dự án');
      setSelectedUserId('');
      loadData();
      onUpdated?.();
    } catch (err) {
      toast.error('Không thêm được thành viên', errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member: ProjectMember) => {
    if (!project) return;
    const ok = await confirm({
      title: `Gỡ "${member.full_name}" khỏi dự án?`,
      description: 'Nhân viên này sẽ không còn là thành viên ban dự án. Quyền truy cập thư mục sẽ không bị tự động xóa trừ khi bạn thu hồi tại trang Phân quyền.',
      confirmText: 'Gỡ khỏi dự án',
    });
    if (!ok) return;
    try {
      await api(`/projects/${project.id}/members/${member.user_id}`, { method: 'DELETE' });
      toast.success('Đã gỡ thành viên khỏi dự án', member.full_name);
      loadData();
      onUpdated?.();
    } catch (err) {
      toast.error('Không gỡ được thành viên', errorMessage(err));
    }
  };

  if (!project) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Icon name="users" size={22} />}
      title="Thành viên ban dự án"
      description={`${project.code} · ${project.name}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {/* Add Member Form */}
      {canManage && (
        <form onSubmit={addMember} style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Thêm nhân sự vào dự án</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <Field label="Chọn nhân viên" required>
              <Combobox
                options={userOptions}
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder="Tìm tên, mã nhân viên..."
              />
            </Field>
            <Field label="Vai trò trong dự án">
              <Select value={customRole} onChange={(e) => setCustomRole(e.target.value)}>
                {PROJECT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" icon="plus" type="submit" loading={adding} disabled={!selectedUserId}>
              Thêm
            </Button>
          </div>
        </form>
      )}

      {/* Members Table */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <span className="spinner" />
        </div>
      ) : !members.length ? (
        <EmptyState
          icon="users"
          title="Chưa có thành viên nào trong ban dự án"
          description="Thêm nhân viên để xác định các vị trí chủ chốt và kỹ sư phụ trách dự án."
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Vai trò ban dự án</th>
                <th>Ngày tham gia</th>
                {canManage && <th style={{ width: '80px', textAlign: 'right' }}>Xóa</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Person name={m.full_name} sub={`${m.employee_code}${m.email ? ` · ${m.email}` : ''}`} size="sm" />
                  </td>
                  <td>
                    <Badge tone={m.project_role.includes('PM') || m.project_role.includes('Chỉ huy trưởng') ? 'blue' : 'gray'}>
                      {m.project_role}
                    </Badge>
                  </td>
                  <td>{formatDate(m.joined_at)}</td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => removeMember(m)}
                        title="Gỡ khỏi ban dự án"
                        aria-label={`Gỡ ${m.full_name}`}
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
