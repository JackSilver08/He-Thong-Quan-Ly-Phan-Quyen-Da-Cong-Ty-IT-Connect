'use client';
import { useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Company, ImportPreview } from '@/lib/types';
import { Button } from './ui/Button';
import { Alert, Card, EmptyState } from './ui/Display';
import { Field, Select } from './ui/Form';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

type ImportModalProps = {
  open: boolean;
  companies: Company[];
  defaultCompanyId?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function ImportModal({ open, companies, defaultCompanyId, onClose, onSuccess }: ImportModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(defaultCompanyId || (companies[0]?.id ?? ''));
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
    }
  };

  const uploadAndPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.warning('Chưa chọn file', 'Vui lòng chọn một file Excel (.xlsx).');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('itc_token') : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/import/preview`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Không phân tích được file');
      }

      const previewData: ImportPreview = await res.json();
      setPreview(previewData);
      toast.success('Đã phân tích xong dữ liệu', `Tìm thấy ${previewData.total_users} nhân sự và ${previewData.total_grants} quyền.`);
    } catch (err) {
      toast.error('Lỗi đọc file Excel', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!preview || !companyId) {
      toast.warning('Thiếu thông tin', 'Vui lòng chọn công ty để áp dụng dữ liệu.');
      return;
    }
    setCommitting(true);
    try {
      const res = await api<{ imported_users: number }>('/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          preview,
        }),
      });
      toast.success('Nhập dữ liệu thành công!', `Đã nạp ${res.imported_users} nhân sự và các quyền tương ứng vào hệ thống.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Không lưu được dữ liệu', errorMessage(err));
    } finally {
      setCommitting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        resetAll();
        onClose();
      }}
      size="xl"
      icon={<Icon name="upload" size={22} />}
      title="Nhập dữ liệu từ Excel (Import)"
      description="Hỗ trợ file ma trận Sonacons File Server (Sonacons_Fileserver_DSPC.xlsx) hoặc danh sách chuẩn."
      footer={
        preview ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <Button variant="secondary" onClick={resetAll} disabled={committing}>
              Chọn file khác
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={onClose} disabled={committing}>
                Hủy
              </Button>
              <Button variant="primary" icon="check" onClick={commitImport} loading={committing}>
                Xác nhận nạp vào CSDL
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Đóng
          </Button>
        )
      }
    >
      {!preview ? (
        <form onSubmit={uploadAndPreview}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <Field label="Công ty tiếp nhận dữ liệu" required>
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </Field>

            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ color: 'var(--primary)', marginBottom: '8px' }}>
                <Icon name="upload" size={36} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>
                {file ? file.name : 'Bấm để chọn file Excel hoặc kéo thả vào đây'}
              </strong>
              <span className="muted" style={{ fontSize: '13px' }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Định dạng hỗ trợ: .xlsx, .xls'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button variant="primary" type="submit" icon="file-text" loading={loading} disabled={!file}>
                Tải lên và xem trước (Preview)
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div>
          {/* Summary KPI Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <Card style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Nhân sự hợp lệ</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>{preview.total_users}</div>
            </Card>
            <Card style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Phòng ban phát hiện</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>{preview.new_departments.length}</div>
            </Card>
            <Card style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Dự án/Thư mục phát hiện</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>{preview.detected_projects.length}</div>
            </Card>
            <Card style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Tổng số quyền (R/W/X)</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#16A34A', marginTop: '2px' }}>{preview.total_grants}</div>
            </Card>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <Alert tone="warning" title={`Cảnh báo dữ liệu (${preview.warnings.length})`}>
              <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', maxHeight: '90px', overflowY: 'auto' }}>
                {preview.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Table Preview (First 15 items) */}
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>
              Danh sách xem trước ({Math.min(15, preview.users.length)}/{preview.users.length} nhân sự)
            </h4>
            <div className="table-scroll" style={{ maxHeight: '260px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Họ và tên</th>
                    <th>Tên đăng nhập</th>
                    <th>Phòng ban</th>
                    <th>Số quyền ghi nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.users.slice(0, 15).map((u, i) => (
                    <tr key={i}>
                      <td><span className="code-chip code-chip-sm">{u.employee_code}</span></td>
                      <td><strong>{u.full_name}</strong></td>
                      <td>{u.username}</td>
                      <td>{u.department_name || '—'}</td>
                      <td>
                        <span style={{ color: Object.keys(u.grants).length > 0 ? '#1D4ED8' : 'var(--muted)', fontWeight: 600 }}>
                          {Object.keys(u.grants).length} quyền
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
