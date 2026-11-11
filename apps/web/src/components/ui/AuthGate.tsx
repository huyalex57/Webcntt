import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from './Button';
import { Modal } from './Modal';

export interface AuthGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGate({ children, fallback }: AuthGateProps) {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (user) return <>{children}</>;

  return (
    <>
      {fallback ?? <Button onClick={() => setShowLogin(true)}>Đăng nhập để tiếp tục</Button>}
      <Modal open={showLogin} onClose={() => setShowLogin(false)} title="Yêu cầu đăng nhập">
        <p className="mb-4 text-ink/70">Bạn cần đăng nhập để sử dụng tính năng này.</p>
        <div className="flex gap-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Đăng nhập ngay
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded border border-border-strong bg-white px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Đăng ký miễn phí
          </Link>
        </div>
      </Modal>
    </>
  );
}
