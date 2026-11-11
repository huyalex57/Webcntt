import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { RoleSwitcher } from '../../features/auth/components/RoleSwitcher';

export const NAV = [
  { to: '/resources', label: 'Kho tài liệu' },
  { to: '/courses', label: 'Khoá học' },
  { to: '/practice', label: 'Luyện AI' },
  { to: '/playground', label: 'Playground' },
  { to: '/exams', label: 'Thi lập trình' },
  { to: '/pricing', label: 'Premium' },
];

export function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-primary text-lg font-bold text-white">
            D
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold">DevStudy Hub</span>
            <span className="block text-xs text-slate-500">Cổng Học Liệu CNTT</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-surface text-primary' : 'text-slate-600 hover:bg-surface'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex">
            <RoleSwitcher />
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => nav('/dashboard')}
                className="rounded border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface"
              >
                {user.displayName} · {user.role} · {user.plan}
              </button>
              <button
                onClick={logout}
                className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-surface"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Đăng ký miễn phí
              </Link>
            </div>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1 lg:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className="whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium text-slate-600"
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
