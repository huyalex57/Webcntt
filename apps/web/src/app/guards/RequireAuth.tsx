import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();
  if (isAuthReady === false) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ redirect: location.pathname }} replace />;
  return <>{children}</>;
}
