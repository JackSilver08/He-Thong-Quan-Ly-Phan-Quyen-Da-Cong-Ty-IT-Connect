'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';

type User = {
  id: string;
  employee_code: string;
  username: string;
  full_name: string;
  company_name: string;
  resigned_at?: string;
  replacement_user_id?: string;
  notes?: string;
};

type ReplacementUser = {
  id: string;
  full_name: string;
  username: string;
};

export default function Resigned() {
  const [items, setItems] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<ReplacementUser[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const result = await api<{ data: User[] }>(
        `/users?status=RESIGNED&q=${encodeURIComponent(q)}`,
      );
      setItems(result.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể tải dữ liệu');
    }
  };

  useEffect(() => {
    Promise.all([
      api<{ data: User[] }>('/users?status=RESIGNED'),
      api<{ data: User[] }>('/users'),
    ])
      .then(([resigned, users]) => {
        setItems(resigned.data);
        setAllUsers(
          users.data.map((user) => ({
            id: user.id,
            full_name: user.full_name,
            username: user.username,
          })),
        );
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Không thể tải dữ liệu');
      });
  }, []);

  return (
    <AuthGuard>
      <Layout>
        <div className="topbar">
          <div>
            <div className="title">Nhân viên nghỉ việc</div>
            <div className="subtitle">Lưu lịch sử nghỉ việc, ghi chú và người thay thế</div>
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="toolbar">
          <input
            className="input"
            placeholder="Tìm nhân viên..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <button className="button" onClick={load}>
            Tìm kiếm
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ tên</th>
                <th>Công ty</th>
                <th>Ngày nghỉ</th>
                <th>Người thay thế</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => {
                const replacement = allUsers.find(
                  (candidate) => candidate.id === user.replacement_user_id,
                );

                return (
                  <tr key={user.id}>
                    <td>{user.employee_code}</td>
                    <td>{user.full_name}</td>
                    <td>{user.company_name}</td>
                    <td>
                      {user.resigned_at
                        ? new Date(user.resigned_at).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      {replacement
                        ? `${replacement.full_name} (${replacement.username})`
                        : user.replacement_user_id || 'Chưa chỉ định'}
                    </td>
                    <td>{user.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!items.length && <div className="empty">Chưa có nhân viên nghỉ việc.</div>}
        </div>
      </Layout>
    </AuthGuard>
  );
}
