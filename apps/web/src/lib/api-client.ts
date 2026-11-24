import type { ApiResponseMeta } from '@devstudy/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

// Token in-memory
let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<{ accessToken: string; user?: any }> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function refreshSession<TUser = any>(): Promise<{ accessToken: string; user: TUser }> {
  if (refreshPromise) {
    return refreshPromise as Promise<{ accessToken: string; user: TUser }>;
  }

  refreshPromise = (async () => {
    let refreshRes: Response;
    try {
      refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch {
      throw {
        message: 'Không thể kết nối đến máy chủ API',
        status: 0,
        code: 'NETWORK_ERROR',
      };
    }

    let refreshJson: any = null;
    try {
      refreshJson = await refreshRes.json();
    } catch {
      refreshJson = null;
    }

    if (!refreshRes.ok || !refreshJson?.data?.accessToken) {
      setAccessToken(null);
      throw (
        refreshJson?.error || {
          message: 'Refresh failed',
          status: refreshRes.status,
        }
      );
    }

    const newToken = refreshJson.data.accessToken as string;
    setAccessToken(newToken);
    return refreshJson.data as { accessToken: string; user: TUser };
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise as Promise<{ accessToken: string; user: TUser }>;
}

async function executeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: ApiResponseMeta }> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const isAuthEndpoint =
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/register');

  // Chờ phiên refresh đang chạy nền (tránh gọi /auth/refresh trùng lặp gây Token Reuse Detection)
  let waitedRefreshFailed = false;
  if (!inMemoryAccessToken && refreshPromise && !isAuthEndpoint) {
    try {
      await refreshPromise;
    } catch {
      waitedRefreshFailed = true;
    }
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Mang cookie refreshToken
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw {
      message: 'Không thể kết nối đến máy chủ API',
      status: 0,
      code: 'NETWORK_ERROR',
    };
  }

  // Xử lý 401: Thử refresh token (gộp chung một promise để tránh xoay vòng trùng)
  if (
    response.status === 401 &&
    !waitedRefreshFailed &&
    !endpoint.includes('/auth/refresh') &&
    !endpoint.includes('/auth/login')
  ) {
    try {
      const { accessToken: newToken } = await refreshSession();

      headers.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(url, { ...config, headers });
      let retryJson: any = null;
      try {
        retryJson = await retryResponse.json();
      } catch {
        retryJson = null;
      }

      if (!retryResponse.ok) {
        throw (
          retryJson?.error || {
            message: `Yêu cầu thất bại với mã lỗi HTTP ${retryResponse.status}`,
            status: retryResponse.status,
          }
        );
      }

      return {
        data: (retryJson?.data !== undefined ? retryJson.data : retryJson) as T,
        meta: retryJson?.meta,
      };
    } catch (refreshErr) {
      setAccessToken(null);
      throw refreshErr;
    }
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw (
      json?.error || {
        message: `Yêu cầu thất bại với mã lỗi HTTP ${response.status}`,
        status: response.status,
      }
    );
  }

  return {
    data: (json?.data !== undefined ? json.data : json) as T,
    meta: json?.meta,
  };
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const result = await executeRequest<T>(endpoint, options);
  return result.data;
}

export async function apiClientWithMeta<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: ApiResponseMeta }> {
  return executeRequest<T>(endpoint, options);
}
