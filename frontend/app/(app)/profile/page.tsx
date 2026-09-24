'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import type { User, UserAccessSummary } from '@/lib/types';
import { useMe } from '@/components/AppShell';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: me?.full_name ?? '', email: me?.email ?? '', phone: me?.phone ?? '' });
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
        body: JSON.stringify({ ...form, full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim(), avatar_url: avatar }),
      });
      setForm({ full_name: updated.full_name, email: updated.email ?? '', phone: updated.phone ?? '' });
      setAvatar(updated.avatar_url ?? '');
      setMessage('Đã lưu thay đổi hồ sơ.');
      router.refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Hồ sơ cá nhân" description="Quản lý thông tin liên hệ, ảnh đại diện và tài khoản của bạn." />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, .8fr)', gap: 18 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={me.full_name} size="md" src={avatar} />
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"
                style={{ position: 'absolute', right: -6, bottom: -6, width: 34, height: 34, borderRadius: 999, border: '3px solid white', background: '#1f80ff', color: 'white', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15 }}>
                ✎
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onAvatar} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 21 }}>{me.full_name}</h2>
              <p style={{ margin: '5px 0 9px', opacity: .68 }}>{me.username} · {me.employee_code}</p>
              <Badge tone="blue">{ROLES[me.role]?.label ?? me.role}</Badge>
            </div>
          </div>

          <section style={{ paddingTop: 22 }}>
            <h3 style={{ margin: '0 0 16px' }}>Thông tin cá nhân</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label className="field"><span className="field-label">Họ và tên</span><input className="input" value={form.full_name} onChange={e => setForm(v => ({ ...v, full_name: e.target.value }))} /></label>
              <label className="field"><span className="field-label">Tên đăng nhập</span><input className="input" value={me.username} disabled /></label>
              <label className="field"><span className="field-label">Email</span><input className="input" type="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} /></label>
              <label className="field"><span className="field-label">Số điện thoại</span><input className="input" type="tel" value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value }))} /></label>
              <label className="field"><span className="field-label">Công ty</span><input className="input" value={me.company_name} disabled /></label>
              <label className="field"><span className="field-label">Phòng ban</span><input className="input" value={me.department_name ?? 'Chưa phân công'} disabled /></label>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22 }}>
            <span style={{ fontSize: 13, opacity: .68 }}>{message || 'Ảnh sẽ được tự động thu nhỏ trước khi lưu.'}</span>
            <Button variant="primary" loading={saving} onClick={save}>Lưu thay đổi</Button>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <Card title="Tài khoản & bảo mật">
            <div style={{ display: 'grid', gap: 13 }}>
              <div><small>Vai trò</small><div style={{ marginTop: 4, fontWeight: 650 }}>{ROLES[me.role]?.label ?? me.role}</div></div>
              <div><small>Trạng thái</small><div style={{ marginTop: 4 }}><Badge tone={me.status === 'ACTIVE' ? 'green' : 'gray'}>{me.status === 'ACTIVE' ? 'Đang hoạt động' : me.status}</Badge></div></div>
              <div><small>Ngày tham gia</small><div style={{ marginTop: 4 }}>{me.joined_at ? new Date(me.joined_at).toLocaleDateString('vi-VN') : 'Chưa có dữ liệu'}</div></div>
            </div>
          </Card>

          <Card title="Quyền truy cập" description="Các dự án và tài nguyên tài khoản hiện có quyền sử dụng.">
            {!access ? (
              <Button variant="secondary" onClick={loadAccess}>Xem quyền của tôi</Button>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <strong>{access.projects.length} dự án</strong>
                <span style={{ opacity: .7 }}>{access.resources.length} tài nguyên</span>
                {access.projects.slice(0, 5).map(p => (
                  <div key={p.project_id} style={{ padding: 10, borderRadius: 10, background: 'var(--surface-subtle, #f7f8fa)' }}>
                    <strong>{p.project_name}</strong>
                    <div style={{ fontSize: 12, opacity: .65 }}>{p.company_name} · {p.level}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
