'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError, getToken, logout } from '@/lib/api';
import { ROLES } from '@/lib/format';
import type { User } from '@/lib/types';
import logo from '@/public/logo.png';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { Avatar, EmptyState } from './ui/Display';
import { Icon, type IconName } from './ui/Icon';

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Array<{ group?: string; items: NavItem[] }> = [
  { items: [{ href: '/', label: 'Tổng quan', icon: 'dashboard' }] },
  {
    group: 'Tổ chức',
    items: [
      { href: '/companies', label: 'Công ty', icon: 'building' },
      { href: '/departments', label: 'Phòng ban', icon: 'network' },
      { href: '/users', label: 'Nhân viên', icon: 'users' },
    ],
  },
  {
    group: 'Truy cập',
    items: [
      { href: '/projects', label: 'Dự án', icon: 'folder' },
      { href: '/permissions', label: 'Phân quyền', icon: 'shield' },
    ],
  },
  {
    group: 'Theo dõi',
    items: [
      { href: '/resigned', label: 'Nghỉ việc', icon: 'user-x' },
      { href: '/audit', label: 'Nhật ký hoạt động', icon: 'history' },
    ],
  },
];

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

// Khớp với phân quyền của API: AUDITOR chỉ xem, USER không vào được trang quản trị.
const PANEL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const MeContext = createContext<User | null>(null);

/** Người đang đăng nhập; các trang bên trong khung app luôn có giá trị. */
export function useMe() {
  return useContext(MeContext);
}

/** Được thêm, sửa, xoá dữ liệu (Kiểm soát viên chỉ được xem). */
export function useCanManage() {
  const me = useMe();
  return !!me && MANAGE_ROLES.includes(me.role);
}

function Gate({ icon, title, description, children }: { icon: IconName; title: string; description: string; children: ReactNode }) {
  return (
    <div className="boot">
      <div className="card gate">
        <EmptyState icon={icon} title={title} description={description} action={<div className="gate-actions">{children}</div>} />
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const current = NAV.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

  const loadMe = useCallback(() => {
    setLoadError(false);
    api<User>('/auth/me')
      .then(setMe)
      .catch((err) => {
        // 401 đã tự chuyển về trang đăng nhập.
        if (!(err instanceof ApiError && err.status === 401)) setLoadError(true);
      });
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
    loadMe();
  }, [router, loadMe]);

  useEffect(() => {
    setNavOpen(false);
    document.title = current ? `${current.label} · IT Connect` : 'IT Connect';
  }, [pathname, current]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  const signOut = async () => {
    const ok = await confirm({
      title: 'Đăng xuất khỏi hệ thống?',
      description: 'Bạn sẽ cần đăng nhập lại để tiếp tục quản lý.',
      confirmText: 'Đăng xuất',
      tone: 'primary',
    });
    if (ok) logout();
  };

  if (!ready || (!me && !loadError)) {
    return (
      <div className="boot" aria-busy="true">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!me) {
    return (
      <Gate icon="circle-alert" title="Không tải được thông tin tài khoản" description="Kiểm tra kết nối tới máy chủ rồi thử lại.">
        <Button variant="primary" onClick={loadMe}>
          Thử lại
        </Button>
        <Button icon="log-out" onClick={logout}>
          Đăng xuất
        </Button>
      </Gate>
    );
  }

  if (!PANEL_ROLES.includes(me.role)) {
    return (
      <Gate
        icon="shield-off"
        title="Tài khoản không có quyền truy cập"
        description={`Trang quản trị chỉ dành cho Quản trị viên và Kiểm soát viên. Tài khoản ${me.username} hiện là ${ROLES[me.role]?.label ?? me.role}.`}
      >
        <Button variant="primary" icon="log-out" onClick={logout}>
          Đăng xuất
        </Button>
      </Gate>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="app">
        <aside className={`sidebar${navOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
          <Link href="/" className="brand" aria-label="IT Connect – Tổng quan">
            <Image src={logo} alt="" sizes="240px" loading="eager" />
          </Link>
          <nav className="nav">
            {NAV.map((group, index) => (
              <div className="nav-group" key={group.group ?? index}>
                {group.group && <p className="nav-group-label">{group.group}</p>}
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} className={`nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-user">
            <Avatar name={me.full_name} />
            <div className="sidebar-user-info">
              <strong title={me.full_name}>{me.full_name}</strong>
              <span>{ROLES[me.role]?.label ?? me.role}</span>
            </div>
            <button type="button" className="icon-btn icon-btn-dark" aria-label="Đăng xuất" title="Đăng xuất" onClick={signOut}>
              <Icon name="log-out" />
            </button>
          </div>
        </aside>
        {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

        <div className="app-main">
          <header className="mobile-bar">
            <button type="button" className="icon-btn icon-btn-dark" aria-label="Mở menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
              <Icon name="menu" />
            </button>
            <span className="mobile-bar-title">{current?.label ?? 'IT Connect'}</span>
            <Avatar name={me.full_name} size="sm" />
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </MeContext.Provider>
  );
}
