import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PlanTier, Role, User, UpdateProfileInput } from '@devstudy/shared';
import { loadJSON, saveJSON } from '../../lib/utils';
import { apiClient, setAccessToken, getAccessToken } from '../../lib/api-client';

export interface DemoIdentity {
  key: string;
  label: string;
  user: User | null;
}

const mk = (
  id: string,
  email: string,
  displayName: string,
  role: Role,
  plan: PlanTier,
  studentId?: string,
  university?: string,
  major?: string
): User => ({
  id,
  email,
  displayName,
  role,
  plan,
  studentId,
  university: university || 'ĐH Bách Khoa Hà Nội',
  major: major || 'Khoa học Máy tính',
  emailVerified: true,
});

export const DEMO_IDENTITIES: DemoIdentity[] = [
  { key: 'guest', label: 'Guest (chưa đăng nhập)', user: null },
  { key: 'student-free', label: 'STUDENT · Free', user: mk('u-student-free', 'huy.nd@edu.vn', 'Nguyễn Đức Huy', 'STUDENT', 'FREE', '20220001', 'ĐH Bách Khoa Hà Nội', 'Kỹ thuật Phần mềm') },
  { key: 'student-premium', label: 'STUDENT · Premium', user: mk('u-student-pro', 'linh.tt@edu.vn', 'Trần Thu Linh', 'STUDENT', 'PREMIUM', '20220042', 'ĐH Khoa học Tự nhiên', 'Khoa học Dữ liệu') },
  { key: 'lecturer-free', label: 'LECTURER · Free', user: mk('u-lect-free', 'tuan.tm@hust.edu.vn', 'TS. Trần Minh Tuấn', 'LECTURER', 'FREE') },
  { key: 'lecturer-premium', label: 'LECTURER · Premium', user: mk('u-lect-pro', 'bao.tq@hust.edu.vn', 'TS. Trịnh Quốc Bảo', 'LECTURER', 'PREMIUM') },
  { key: 'moderator', label: 'MODERATOR', user: mk('u-mod', 'mod@devstudy.edu.vn', 'Kiểm duyệt viên', 'MODERATOR', 'FREE') },
  { key: 'admin', label: 'ADMIN', user: mk('u-admin', 'admin@devstudy.edu.vn', 'Quản trị viên', 'ADMIN', 'FREE') },
];

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface AuthValue {
  user: User | null;
  demoKey: string;
  getToken: () => string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, studentId?: string, university?: string, password?: string) => Promise<User>;
  logout: () => void;
  switchDemo: (key: string) => void;
  upgradeToPremium: () => void;
  updateProfile: (data: UpdateProfileInput) => Promise<User>;
  changePassword: (currentPass: string, newPass: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPass: string) => Promise<boolean>;
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

  const persist = (u: User | null, key: string) => {
    setUser(u);
    setDemoKey(key);
    saveJSON('session-user', u);
  };

  const getToken = useCallback(() => getAccessToken(), []);

  // Kiểm tra phiên đăng nhập từ Backend khi ứng dụng load (refresh cookie)
  useEffect(() => {
    if (USE_MOCK) return;

    let mounted = true;
    apiClient<{ accessToken: string; user: User }>('/auth/refresh', { method: 'POST' })
      .then((res) => {
        if (!mounted) return;
        setAccessToken(res.accessToken);
        persist(res.user, 'student-free');
      })
      .catch(() => {
        if (!mounted) return;
        // Nếu không có cookie hợp lệ thì chuyển về guest nếu đang không dùng mock
        if (!loadJSON<User | null>('session-user', null)) {
          persist(null, 'guest');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 500));
      const found = DEMO_IDENTITIES.find((d) => d.user?.email === email)?.user;
      const u = found ?? mk('u-' + Date.now(), email, email.split('@')[0], 'STUDENT', 'FREE');
      setAccessToken('mock-access-' + Math.random().toString(36).slice(2));
      const key = DEMO_IDENTITIES.find((d) => d.user?.email === email)?.key ?? 'student-free';
      persist(u, key);
      return u;
    }

    const res = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAccessToken(res.accessToken);
    const match = DEMO_IDENTITIES.find((d) => d.user?.email === res.user.email);
    persist(res.user, match ? match.key : 'student-free');
    return res.user;
  }, []);

  const register = useCallback(
    async (name: string, email: string, studentId?: string, university?: string, password = 'password123') => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        const u = mk('u-' + Date.now(), email, name, 'STUDENT', 'FREE', studentId, university);
        setAccessToken('mock-access-' + Math.random().toString(36).slice(2));
        persist(u, 'student-free');
        return u;
      }

      const res = await apiClient<{ user: User; accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: name,
          email,
          studentId: studentId || '20230001',
          university: university || 'ĐH Bách Khoa',
          password,
          confirmPassword: password,
          agree: true,
        }),
      });

      setAccessToken(res.accessToken);
      persist(res.user, 'student-free');
      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    if (!USE_MOCK) {
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch (err) {
        // bỏ qua lỗi nếu có
      }
    }
    setAccessToken(null);
    persist(null, 'guest');
  }, []);

  const switchDemo = useCallback(async (key: string) => {
    const d = DEMO_IDENTITIES.find((x) => x.key === key);
    if (!d || !d.user) {
      setAccessToken(null);
      persist(null, 'guest');
      return;
    }

    if (USE_MOCK) {
      setAccessToken('mock-access-demo-' + key);
      persist(d.user, key);
      return;
    }

    // Với Backend thật: tự động login tài khoản demo tương ứng
    try {
      const res = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: d.user.email, password: 'password123' }),
      });
      setAccessToken(res.accessToken);
      persist(res.user, key);
    } catch {
      // Fallback nếu server chưa có user
      setAccessToken('mock-access-demo-' + key);
      persist(d.user, key);
    }
  }, []);

  const upgradeToPremium = useCallback(() => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, plan: 'PREMIUM' as PlanTier };
      saveJSON('session-user', next);
      return next;
    });
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileInput) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      let updated: User | null = null;
      setUser((current) => {
        if (!current) throw new Error('Chưa đăng nhập');
        updated = {
          ...current,
          displayName: data.displayName,
          studentId: data.studentId ?? current.studentId,
          university: data.university ?? current.university,
          major: data.major ?? current.major,
        };
        saveJSON('session-user', updated);
        return updated;
      });
      return updated!;
    }

    const updated = await apiClient<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    setUser(updated);
    saveJSON('session-user', updated);
    return updated;
  }, []);

  const changePassword = useCallback(async (currentPass: string, newPass: string) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }

    await apiClient('/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: currentPass,
        newPassword: newPass,
        confirmNewPassword: newPass,
      }),
    });
    return true;
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }

    await apiClient('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return true;
  }, []);

  const resetPassword = useCallback(async (_token: string, newPass: string) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }

    await apiClient('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: newPass,
        confirmPassword: newPass,
      }),
    });
    return true;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      demoKey,
      getToken,
      login,
      register,
      logout,
      switchDemo,
      upgradeToPremium,
      updateProfile,
      changePassword,
      forgotPassword,
      resetPassword,
    }),
    [
      user,
      demoKey,
      getToken,
      login,
      register,
      logout,
      switchDemo,
      upgradeToPremium,
      updateProfile,
      changePassword,
      forgotPassword,
      resetPassword,
    ]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
  return ctx;
}
