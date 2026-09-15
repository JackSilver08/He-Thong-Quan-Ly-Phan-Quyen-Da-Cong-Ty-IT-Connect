'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api, errorMessage, setToken } from '@/lib/api';
import { clearQuery, readQuery } from '@/lib/format';
import logo from '@/public/logo.png';
import { useToast } from '@/components/ui/Toast';
import styles from './login.module.css';

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (readQuery('expired')) toast.warning('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.');
    clearQuery();
  }, [toast]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.warning('Thiếu thông tin đăng nhập', 'Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
      setToken(data.token);
      toast.success('Đăng nhập thành công', 'Chào mừng bạn trở lại IT Connect.');
      router.replace('/');
    } catch (err) {
      toast.error('Đăng nhập thất bại', errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.panel}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <h1 className={styles.heading}>
            <span className={styles.welcome}>Chào mừng</span>
            <span className={styles.back}>Trở lại!</span>
          </h1>

          <label className={styles.field}>
            <span className={styles.srOnly}>Tên đăng nhập</span>
            <input className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tên đăng nhập..." autoComplete="username" autoFocus />
          </label>

          <label className={styles.field}>
            <span className={styles.srOnly}>Mật khẩu</span>
            <input className={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu..." type="password" autoComplete="current-password" />
          </label>

          <div className={`${styles.field} ${styles.submit}`}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Enter'}
            </button>
          </div>
        </form>
      </main>

      <aside className={styles.brand}>
        <div className={styles.logoCircle}>
          <Image className={styles.logo} src={logo} alt="IT Connect" sizes="(max-width: 1023px) 240px, 30vw" loading="eager" />
        </div>
      </aside>
    </div>
  );
}
