import { getToken } from './api';

export async function downloadExcel(path: string, filename: string): Promise<void> {
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API}${path}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Tải file thất bại (mã lỗi ${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
