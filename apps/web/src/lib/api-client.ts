import type { ApiResponse } from '@devstudy/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

// Token in-memory
let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

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
  } catch (err: any) {
    throw {
      message: 'Không thể kết nối đến máy chủ API',
      status: 0,
      code: 'NETWORK_ERROR',
    };
  }

  // Xử lý 401: Thử refresh token
  if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
    if (isRefreshing) {
      // Đang có request khác refresh -> chờ
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: async (newToken: string) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            try {
              const retryRes = await fetch(url, { ...config, headers });
              const json = (await retryRes.json()) as ApiResponse<T>;
              if (!retryRes.ok) throw json.error;
              resolve(json.data);
            } catch (retryErr) {
              reject(retryErr);
            }
          },
          reject: (err) => reject(err),
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const refreshJson = await refreshRes.json();

      if (!refreshRes.ok || !refreshJson.data?.accessToken) {
        throw refreshJson.error || new Error('Refresh failed');
      }

      const newToken = refreshJson.data.accessToken;
      setAccessToken(newToken);
      processQueue(null, newToken);

      // Thử lại request hiện tại
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(url, { ...config, headers });
      const retryData = (await retryResponse.json()) as ApiResponse<T>;

      if (!retryResponse.ok) {
        throw retryData.error;
      }

      return retryData.data;
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      setAccessToken(null);
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw json?.error || {
      message: `Yêu cầu thất bại với mã lỗi HTTP ${response.status}`,
      status: response.status,
    };
  }

  return (json?.data !== undefined ? json.data : json) as T;
}
