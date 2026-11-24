import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PlanTier, Role, User, UpdateProfileInput } from '@devstudy/shared';
import { loadJSON, saveJSON } from '../../lib/utils';
import { apiClient, refreshSession, setAccessToken, getAccessToken } from '../../lib/api-client';

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
  { key: 'student-free', label: 'STUDENT · Free', user: mk('u-student-free', 'huy.nd@edu.vn', 'Nguyễn Đức Huy', 'STUDENT', 'FREE', '20210001', 'ĐH Bách Khoa Hà Nội', 'Khoa học Máy tính') },
  { key: 'student-premium', label: 'STUDENT · Premium', user: mk('u-student-pro', 'linh.tt@edu.vn', 'Trần Thị Linh', 'STUDENT', 'PREMIUM', '20210002', 'ĐH Công nghệ — ĐHQGHN', 'Kỹ thuật Phần mềm') },
  { key: 'lecturer-free', label: 'LECTURER · Free', user: mk('u-lect-free', 'tuan.tm@hust.edu.vn', 'TS. Trần Minh Tuấn', 'LECTURER', 'FREE', 'GV201501', 'ĐH Bách Khoa Hà Nội', 'Khoa học Máy tính') },
  { key: 'lecturer-premium', label: 'LECTURER · Premium', user: mk('u-lect-pro', 'bao.tq@hust.edu.vn', 'ThS. Tạ Quang Bảo', 'LECTURER', 'PREMIUM', 'GV201802', 'ĐH Bách Khoa Hà Nội', 'Hệ thống Thông tin') },
  { key: 'moderator', label: 'MODERATOR', user: mk('u-mod', 'mod@devstudy.edu.vn', 'Ban Kiểm Duyệt Nội Dung', 'MODERATOR', 'FREE', undefined, 'DevStudy Hub', 'Kiểm duyệt học liệu') },
  { key: 'admin', label: 'ADMIN', user: mk('u-admin', 'admin@devstudy.edu.vn', 'Quản Trị Viên Hệ Thống', 'ADMIN', 'PREMIUM', undefined, 'DevStudy Hub', 'Vận hành hệ thống') },
];

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface AuthValue {
  user: User | null;
  demoKey: string;
  isAuthReady?: boolean;
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(() => loadJSON<User | null>('session-user', null));
  const [isAuthReady, setIsAuthReady] = useState<boolean>(
    () => USE_MOCK || loadJSON<User | null>('session-user', null) === null
  );
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
    if (USE_MOCK) {
      setIsAuthReady(true);
      return;
    }

    const savedUser = loadJSON<User | null>('session-user', null);
    if (!savedUser) {
      setIsAuthReady(true);
      return;
    }

    let mounted = true;
    refreshSession<User>()
      .then((res) => {
        if (!mounted) return;
        const match = DEMO_IDENTITIES.find((d) => d.user?.email === res.user.email);
        persist(res.user, match ? match.key : 'student-free');
      })
      .catch((err: any) => {
        if (!mounted) return;
        // Nếu cookie không tồn tại/hết hạn/không hợp lệ (401/403) -> xoá session cũ để tránh vòng lặp 401
        if (err?.status === 401 || err?.status === 403) {
          setAccessToken(null);
          persist(null, 'guest');
        }
      })
      .finally(() => {
        if (mounted) setIsAuthReady(true);
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
      queryClient.clear();
      const key = DEMO_IDENTITIES.find((d) => d.user?.email === email)?.key ?? 'student-free';
      persist(u, key);
      return u;
    }

    const res = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAccessToken(res.accessToken);
    queryClient.clear();
    const match = DEMO_IDENTITIES.find((d) => d.user?.email === res.user.email);
    persist(res.user, match ? match.key : 'student-free');
    setIsAuthReady(true);
    return res.user;
  }, [queryClient]);

  const register = useCallback(
    async (name: string, email: string, studentId?: string, university?: string, password = 'password123') => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        const u = mk('u-' + Date.now(), email, name, 'STUDENT', 'FREE', studentId, university);
        setAccessToken('mock-access-' + Math.random().toString(36).slice(2));
        queryClient.clear();
        persist(u, 'student-free');
        setIsAuthReady(true);
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
      queryClient.clear();
      persist(res.user, 'student-free');
      setIsAuthReady(true);
      return res.user;
    },
    [queryClient]
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
    queryClient.clear();
    persist(null, 'guest');
    setIsAuthReady(true);
  }, [queryClient]);

  const switchDemo = useCallback(async (key: string) => {
    const d = DEMO_IDENTITIES.find((x) => x.key === key);
    if (!d || !d.user) {
      if (!USE_MOCK) {
        try {
          await apiClient('/auth/logout', { method: 'POST' });
        } catch {
          // bỏ qua lỗi mạng khi đăng xuất demo
        }
      }
      setAccessToken(null);
      queryClient.clear();
      persist(null, 'guest');
      setIsAuthReady(true);
      return;
    }

    if (USE_MOCK) {
      setAccessToken('mock-access-demo-' + key);
      queryClient.clear();
      persist(d.user, key);
      setIsAuthReady(true);
      return;
    }

    // Với Backend thật: tự động login tài khoản demo tương ứng
    try {
      const res = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: d.user.email, password: 'password123' }),
      });
      setAccessToken(res.accessToken);
      queryClient.clear();
      persist(res.user, key);
      setIsAuthReady(true);
    } catch {
      // Fallback nếu server chưa có user
      setAccessToken('mock-access-demo-' + key);
      queryClient.clear();
      persist(d.user, key);
      setIsAuthReady(true);
    }
  }, [queryClient]);

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
      isAuthReady,
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
      isAuthReady,
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
