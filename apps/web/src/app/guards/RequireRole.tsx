import type { Role } from '@devstudy/shared';
import { useAuth } from '../../features/auth/AuthContext';
import { EmptyState } from '../../components/ui';

export function RequireRole({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) {
    return <EmptyState title="Không có quyền truy cập" description="Bạn không có quyền xem trang này." />;
  }
  return <>{children}</>;
}
