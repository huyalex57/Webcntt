import type { PlanTier } from '@devstudy/shared';
import { useAuth } from '../../features/auth/AuthContext';
import { EmptyState } from '../../components/ui';
import { Link } from 'react-router-dom';

export function RequirePlan({ min, children }: { min: PlanTier; children: React.ReactNode }) {
  const { user } = useAuth();
  if (min === 'PREMIUM' && user?.plan !== 'PREMIUM') {
    return (
      <EmptyState
        title="Yêu cầu gói Premium"
        description="Tính năng này yêu cầu gói Premium. Nâng cấp để sử dụng."
      >
        <Link to="/pricing" className="mt-4 inline-block rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
          Xem bảng giá
        </Link>
      </EmptyState>
    );
  }
  return <>{children}</>;
}
