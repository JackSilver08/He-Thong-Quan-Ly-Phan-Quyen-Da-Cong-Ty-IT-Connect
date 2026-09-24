'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError, getToken, logout } from '@/lib/api';
import { ROLES } from '@/lib/format';
import type { User } from '@/lib/types';
import logo from '@/public/logo-brand.png';
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

const USER_NAV: Array<{ group?: string; items: NavItem[] }> = [
  { items: [{ href: '/my-access', label: 'Quyền truy cập của tôi', icon: 'shield' }] },
];

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

const PANEL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'USER'];
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

  const navItems = me?.role === 'USER' ? USER_NAV : NAV;
  const current = navItems.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

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
    if (me && me.role === 'USER' && pathname !== '/my-access') {
      router.replace('/my-access');
    }
  }, [me, pathname, router]);

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
        description={`Tài khoản ${me.username} không có quyền sử dụng hệ thống.`}
      >
        <Button variant="primary" icon="log-out" onClick={logout}>
          Đăng xuất
        </Button>
      </Gate>
    );
  }

  // Chặn người dùng thường (USER) truy cập các trang quản trị, chuyển hướng an toàn về /my-access
  if (me.role === 'USER' && pathname !== '/my-access') {
    return (
      <div className="boot" aria-busy="true">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="app">
        <aside className={`sidebar${navOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
          <div className="brand-wrapper">
            <Link href={me.role === 'USER' ? '/my-access' : '/'} className="brand-link" aria-label="IT Connect – Trang chủ">
              <div className="brand-circle">
                <Image src={logo} alt="IT Connect" width={80} height={34} priority className="brand-logo-circle" />
              </div>
            </Link>
          </div>
          <nav className="nav">
            {navItems.map((group, index) => (
              <div className="nav-group" key={group.group ?? index}>
                {group.group && <p className="nav-group-label">{group.group}</p>}
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} title={item.label} className={`nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <Icon name={item.icon} />
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <Link href="/profile" className="sidebar-user" title="Mở hồ sơ cá nhân">
            <div className="sidebar-user-avatar-wrap">
              <Avatar name={me.full_name} size="sm" src={me.avatar_url} />
              <span className="status-dot-pulse" title="Trực tuyến" />
            </div>
            <div className="sidebar-user-info">
              <strong className="sidebar-user-name" title={me.full_name}>{me.full_name}</strong>
              <div className="sidebar-user-meta">
                <span className="role-tag" title={ROLES[me.role]?.label ?? me.role}>
                  {ROLES[me.role]?.label ?? me.role}
                </span>
                {me.employee_code && (
                  <>
                    <span className="meta-dot" aria-hidden="true">•</span>
                    <span className="emp-tag" title={`Mã NV: ${me.employee_code}`}>{me.employee_code}</span>
                  </>
                )}
              </div>
            </div>
            <button type="button" className="icon-btn icon-btn-dark sidebar-logout" aria-label="Đăng xuất" title="Đăng xuất" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void signOut(); }}>
              <Icon name="log-out" size={16} />
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
