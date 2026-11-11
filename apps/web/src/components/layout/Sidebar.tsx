import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

export const SIDEBAR = [
  { to: '/dashboard', label: 'Tổng quan' },
  { to: '/resources', label: 'Kho tài liệu' },
  { to: '/courses', label: 'Khoá học trực tuyến' },
  { to: '/my-courses', label: 'Khoá học của tôi' },
  { to: '/practice', label: 'AI ôn tập & Lộ trình' },
  { to: '/playground', label: 'Code Playground' },
  { to: '/exams', label: 'Thi lập trình' },
  { to: '/admin', label: 'Quản trị & Kiểm duyệt' },
];

export function Sidebar() {
  const { user } = useAuth();
  const isPremium = user?.plan === 'PREMIUM';

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <nav className="sticky top-24 space-y-1">
        {SIDEBAR.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-white hover:text-primary'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
        <div className="mt-4 rounded-lg border border-border bg-white p-3 text-xs text-slate-500">
          {isPremium ? (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-primary">Gói Premium</p>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Đang dùng
                </span>
              </div>
              <p className="mt-1">AI không giới hạn · Sandbox 1 GB · 200 lần chạy/ngày.</p>
              <Link to="/pricing" className="mt-2 inline-block font-semibold text-primary">
                Xem chi tiết quyền lợi →
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">Gói Free</p>
              <p className="mt-1">AI 10 câu/ngày · Sandbox 256 MB · 30 lần chạy/ngày.</p>
              <Link to="/pricing" className="mt-2 inline-block font-semibold text-primary">
                Nâng cấp Premium →
              </Link>
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}
