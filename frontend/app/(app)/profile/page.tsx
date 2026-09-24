'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { User, UserAccessSummary } from '@/lib/types';
import { useMe } from '@/components/AppShell';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ROLES } from '@/lib/format';

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('avatar is invalid'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('avatar is invalid'));
      image.onload = () => {
        const size = Math.min(512, Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('avatar is invalid'));
        const scale = Math.min(size / image.width, size / image.height);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        ctx.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
        resolve(canvas.toDataURL('image/webp', 0.84));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const me = useMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    full_name: me?.full_name ?? '',
    email: me?.email ?? '',
    phone: me?.phone ?? '',
  });
  const [avatar, setAvatar] = useState(me?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [access, setAccess] = useState<UserAccessSummary | null>(null);

  if (!me) return null;

  const loadAccess = async () => {
    try {
      setAccess(await api<UserAccessSummary>('/my/access'));
    } catch {}
  };

  const onAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Chỉ hỗ trợ JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 8 MB.');
      return;
    }

    try {
      setAvatar(await compressImage(file));
      setMessage('');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const save = async () => {
    if (!form.full_name.trim()) {
      setMessage('Vui lòng nhập họ và tên.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const updated = await api<User>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          avatar_url: avatar,
        }),
      });

      setForm({
        full_name: updated.full_name,
        email: updated.email ?? '',
        phone: updated.phone ?? '',
      });
      setAvatar(updated.avatar_url ?? '');
      setMessage('Đã lưu thay đổi hồ sơ.');
      window.location.reload();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Tài khoản"
        title="Hồ sơ cá nhân"
        description="Quản lý thông tin liên hệ, ảnh đại diện và tài khoản của bạn."
      />

      <div className="profile-page">
        <Card className="profile-hero">
          <div className="profile-hero-inner">
            <div className="profile-avatar-block">
              <Avatar name={me.full_name} size="md" src={avatar} />
              <button
                type="button"
                className="profile-avatar-edit"
                onClick={() => fileRef.current?.click()}
                aria-label="Đổi ảnh đại diện"
                title="Đổi ảnh đại diện"
              >
                <Icon name="pencil" size={15} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={onAvatar}
              />
            </div>

            <div className="profile-identity">
              <div className="profile-identity-top">
                <h2>{me.full_name}</h2>
                <Badge tone="blue">{ROLES[me.role]?.label ?? me.role}</Badge>
              </div>
              <p className="profile-username">{me.username} · {me.employee_code}</p>
              <div className="profile-meta">
                <span>{me.company_name}</span>
                <span className="profile-meta-dot">•</span>
                <span>{me.department_name ?? 'Chưa phân công'}</span>
              </div>
            </div>

            <div className="profile-status">
              <Badge tone={me.status === 'ACTIVE' ? 'green' : 'gray'} dot>
                {me.status === 'ACTIVE' ? 'Đang hoạt động' : me.status}
              </Badge>
            </div>
          </div>
        </Card>

        <div className="profile-grid">
          <Card
            className="profile-main-card"
            title="Thông tin cá nhân"
            description="Bạn có thể cập nhật các thông tin liên hệ của tài khoản."
          >
            <div className="profile-fields">
              <label className="field">
                <span className="field-label">Họ và tên</span>
                <input
                  className="control"
                  value={form.full_name}
                  onChange={e => setForm(v => ({ ...v, full_name: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="field-label">Tên đăng nhập</span>
                <input className="control" value={me.username} disabled />
              </label>

              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="control"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="field-label">Số điện thoại</span>
                <input
                  className="control"
                  type="tel"
                  value={form.phone ?? ''}
                  onChange={e => setForm(v => ({ ...v, phone: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="field-label">Công ty</span>
                <input className="control" value={me.company_name} disabled />
              </label>

              <label className="field">
                <span className="field-label">Phòng ban</span>
                <input className="control" value={me.department_name ?? 'Chưa phân công'} disabled />
              </label>
            </div>

            <div className="profile-actions">
              <span className="profile-message">{message || 'Ảnh sẽ được tự động thu nhỏ trước khi lưu.'}</span>
              <Button variant="primary" loading={saving} onClick={save}>
                Lưu thay đổi
              </Button>
            </div>
          </Card>

          <div className="profile-side">
            <Card className="profile-security-card" title="Tài khoản & bảo mật">
              <div className="profile-security-list">
                <div className="profile-security-row">
                  <span>Vai trò</span>
                  <strong>{ROLES[me.role]?.label ?? me.role}</strong>
                </div>
                <div className="profile-security-row">
                  <span>Trạng thái</span>
                  <Badge tone={me.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {me.status === 'ACTIVE' ? 'Đang hoạt động' : me.status}
                  </Badge>
                </div>
                <div className="profile-security-row">
                  <span>Ngày tham gia</span>
                  <strong>{me.joined_at ? new Date(me.joined_at).toLocaleDateString('vi-VN') : 'Chưa có dữ liệu'}</strong>
                </div>
              </div>
            </Card>

            <Card
              title="Quyền truy cập"
              description="Các dự án và tài nguyên tài khoản hiện có quyền sử dụng."
            >
              {!access ? (
                <Button variant="secondary" icon="shield" onClick={loadAccess}>
                  Xem quyền của tôi
                </Button>
              ) : (
                <div className="profile-access">
                  <div className="profile-access-summary">
                    <div>
                      <strong>{access.projects.length}</strong>
                      <span>Dự án</span>
                    </div>
                    <div>
                      <strong>{access.resources.length}</strong>
                      <span>Tài nguyên</span>
                    </div>
                  </div>

                  {access.projects.slice(0, 5).map(p => (
                    <div key={p.project_id} className="profile-access-item">
                      <div>
                        <strong>{p.project_name}</strong>
                        <span>{p.company_name}</span>
                      </div>
                      <Badge tone={p.level === 'WRITE' ? 'blue' : 'green'}>{p.level}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
