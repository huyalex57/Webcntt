import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DEMO_IDENTITIES, useAuth } from '../features/auth/AuthContext';
import { Select } from './ui';

const NAV = [
  { to: '/resources', label: 'Kho tài liệu' },
  { to: '/courses', label: 'Khoá học' },
  { to: '/practice', label: 'Luyện AI' },
  { to: '/playground', label: 'Playground' },
  { to: '/exams', label: 'Thi lập trình' },
  { to: '/pricing', label: 'Premium' },
];
const SIDEBAR = [
  { to: '/dashboard', label: 'Tổng quan' },
  { to: '/resources', label: 'Kho tài liệu' },
  { to: '/courses', label: 'Khoá học trực tuyến' },
  { to: '/my-courses', label: 'Khoá học của tôi' },
  { to: '/practice', label: 'AI ôn tập & Lộ trình' },
  { to: '/playground', label: 'Code Playground' },
  { to: '/exams', label: 'Thi lập trình' },
  { to: '/admin', label: 'Quản trị & Kiểm duyệt' },
];

export function Header() {
  const { user, demoKey, switchDemo, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-primary text-lg font-bold text-white">D</span>
          <span className="leading-tight"><span className="block text-base font-bold">DevStudy Hub</span><span className="block text-xs text-slate-500">Cổng Học Liệu CNTT</span></span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? 'bg-surface text-primary' : 'text-slate-600 hover:bg-surface'}`}>{n.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center gap-1 text-xs font-medium text-slate-500 md:flex">Demo: đổi vai trò
            <Select value={demoKey} onChange={(e) => switchDemo(e.target.value)} className="w-44 py-1.5 text-xs">
              {DEMO_IDENTITIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </Select>
          </label>
          {user ? (
            <div className="flex items-center gap-2">
              <button onClick={() => nav('/dashboard')} className="rounded border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface">{user.displayName} · {user.role} · {user.plan}</button>
              <button onClick={logout} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-surface">Đăng xuất</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="rounded border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface">Đăng nhập</Link>
              <Link to="/register" className="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">Đăng ký miễn phí</Link>
            </div>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1 lg:hidden">
        {NAV.map((n) => <NavLink key={n.to} to={n.to} className="whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium text-slate-600">{n.label}</NavLink>)}
      </nav>
    </header>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {SIDEBAR.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => `block rounded px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-slate-600 hover:bg-white hover:text-primary'}`}>{n.label}</NavLink>)}
            <div className="mt-4 rounded-lg border border-border bg-white p-3 text-xs text-slate-500">
              <p className="font-semibold text-ink">Gói Free</p>
              <p className="mt-1">AI 10 câu/ngày · Sandbox 256 MB · 30 lần chạy/ngày.</p>
              <Link to="/pricing" className="mt-2 inline-block font-semibold text-primary">Nâng cấp Premium →</Link>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
      <footer className="border-t border-border bg-white py-6 text-center text-xs text-slate-500">© 2026 DevStudy Hub — Nền tảng Học · Luyện · Thi dành cho sinh viên CNTT. Bản demo dùng dữ liệu mock.</footer>
    </div>
  );
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main><Outlet /></main>
      <footer className="border-t border-border bg-white py-6 text-center text-xs text-slate-500">© 2026 DevStudy Hub — Nền tảng Học · Luyện · Thi dành cho sinh viên CNTT.</footer>
    </div>
  );
}
