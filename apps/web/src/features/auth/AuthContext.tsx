import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlanTier, Role, User } from '@devstudy/shared';
import { loadJSON, saveJSON } from '../../lib/utils';

export interface DemoIdentity { key: string; label: string; user: User | null; }
const mk = (id: string, email: string, displayName: string, role: Role, plan: PlanTier, studentId?: string, university?: string): User =>
  ({ id, email, displayName, role, plan, studentId, university: university || 'ĐH Bách Khoa Hà Nội', emailVerified: true });

export const DEMO_IDENTITIES: DemoIdentity[] = [
  { key: 'guest', label: 'Guest (chưa đăng nhập)', user: null },
  { key: 'student-free', label: 'STUDENT · Free', user: mk('u-student-free', 'huy.nd@edu.vn', 'Nguyễn Đức Huy', 'STUDENT', 'FREE', '20220001') },
  { key: 'student-premium', label: 'STUDENT · Premium', user: mk('u-student-pro', 'linh.tt@edu.vn', 'Trần Thu Linh', 'STUDENT', 'PREMIUM', '20220042') },
  { key: 'lecturer-free', label: 'LECTURER · Free', user: mk('u-lect-free', 'tuan.tm@hust.edu.vn', 'TS. Trần Minh Tuấn', 'LECTURER', 'FREE') },
  { key: 'lecturer-premium', label: 'LECTURER · Premium', user: mk('u-lect-pro', 'bao.tq@hust.edu.vn', 'TS. Trịnh Quốc Bảo', 'LECTURER', 'PREMIUM') },
  { key: 'moderator', label: 'MODERATOR', user: mk('u-mod', 'mod@devstudy.edu.vn', 'Kiểm duyệt viên', 'MODERATOR', 'FREE') },
  { key: 'admin', label: 'ADMIN', user: mk('u-admin', 'admin@devstudy.edu.vn', 'Quản trị viên', 'ADMIN', 'FREE') },
];

interface AuthValue {
  user: User | null;
  demoKey: string;
  getToken: () => string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, studentId?: string, university?: string) => Promise<User>;
  logout: () => void;
  switchDemo: (key: string) => void;
  upgradeToPremium: () => void;
}
const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadJSON<User | null>('session-user', null));
  const [demoKey, setDemoKey] = useState<string>(() => {
    const saved = loadJSON<User | null>('session-user', null);
    if (!saved) return 'guest';
    const match = DEMO_IDENTITIES.find((d) => d.user?.email === saved.email || d.user?.id === saved.id);
    return match ? match.key : 'student-free';
  });

  // Access token CHỈ lưu in-memory (workflow §5.1) — không localStorage/cookie.
  const tokenRef = useRef<string | null>(
    loadJSON<User | null>('session-user', null)
      ? 'mock-access-' + Math.random().toString(36).slice(2)
      : null
  );

  const persist = (u: User | null, key: string) => {
    setUser(u);
    setDemoKey(key);
    saveJSON('session-user', u);
  };

  const getToken = useCallback(() => tokenRef.current, []);

  const login = useCallback(async (email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 500));
    const found = DEMO_IDENTITIES.find((d) => d.user?.email === email)?.user;
    const u = found ?? mk('u-' + Date.now(), email, email.split('@')[0], 'STUDENT', 'FREE');
    tokenRef.current = 'mock-access-' + Math.random().toString(36).slice(2);
    const key = DEMO_IDENTITIES.find((d) => d.user?.email === email)?.key ?? 'student-free';
    persist(u, key);
    return u;
  }, []);

  const register = useCallback(async (name: string, email: string, studentId?: string, university?: string) => {
    await new Promise((r) => setTimeout(r, 600));
    const u = mk('u-' + Date.now(), email, name, 'STUDENT', 'FREE', studentId, university);
    tokenRef.current = 'mock-access-' + Math.random().toString(36).slice(2);
    persist(u, 'student-free');
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenRef.current = null;
    persist(null, 'guest');
  }, []);

  const switchDemo = useCallback((key: string) => {
    const d = DEMO_IDENTITIES.find((x) => x.key === key);
    if (!d) return;
    tokenRef.current = d.user ? 'mock-access-demo-' + key : null;
    persist(d.user, key);
  }, []);

  const upgradeToPremium = useCallback(() => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, plan: 'PREMIUM' as PlanTier };
      saveJSON('session-user', next);
      return next;
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, demoKey, getToken, login, register, logout, switchDemo, upgradeToPremium }),
    [user, demoKey, getToken, login, register, logout, switchDemo, upgradeToPremium]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
  return ctx;
}
