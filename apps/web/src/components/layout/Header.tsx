import { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Hamburger button on mobile */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:bg-surface lg:hidden"
            aria-label="Mở menu điều hướng"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-primary text-lg font-bold text-white shadow-sm">
              D
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-primary">DevStudy Hub</span>
              <span className="block text-xs text-slate-500">Cổng Học Liệu CNTT</span>
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-surface text-primary font-semibold' : 'text-slate-600 hover:bg-surface hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex">
            <RoleSwitcher />
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-1.5 rounded border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface transition-colors"
                title="Xem trang cá nhân"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {user.displayName.charAt(0)}
                </span>
                <span className="max-w-[120px] truncate sm:max-w-none">{user.displayName}</span>
              </Link>
              <button
                onClick={logout}
                className="rounded px-2.5 py-1.5 text-xs text-slate-500 hover:bg-surface hover:text-red-600 transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="hidden rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors sm:inline-block"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[57px] z-50 flex flex-col bg-white p-4 shadow-xl lg:hidden">
          <div className="mb-4 pb-3 border-b border-border">
            <RoleSwitcher />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-base font-medium ${
                    isActive ? 'bg-primary/10 text-primary font-bold' : 'text-slate-700 hover:bg-surface'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user && (
              <>
                <div className="my-2 border-t border-border" />
                <NavLink
                  to="/dashboard"
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-surface"
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/my-courses"
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-surface"
                >
                  Khoá học của tôi
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-surface"
                >
                  Hồ sơ cá nhân
                </NavLink>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
