import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminModerationStats,
  ApiResponseMeta,
  CreateResourceBody,
  PresignUploadRequest,
  PresignUploadResponse,
  Resource,
  ResourceComment,
  ResourceReportItem,
} from '@devstudy/shared';
import { apiClient, apiClientWithMeta } from '../../../lib/api-client';
import * as mockApi from '../../../lib/api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export interface ResourceQueryFilter {
  q?: string;
  topic?: string;
  type?: string;
  level?: string;
  format?: string;
  source?: string;
  sourceType?: string;
  status?: string;
  mine?: boolean;
  saved?: boolean;
  trending?: boolean;
  cursor?: string;
  page?: number;
  limit?: number;
}

function buildResourceQueryString(f: ResourceQueryFilter): string {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.topic) params.set('topic', f.topic);
  if (f.type) params.set('type', f.type);
  if (f.level) params.set('level', f.level);
  if (f.format) params.set('format', f.format);
  if (f.source) params.set('source', f.source);
  if (f.sourceType) params.set('sourceType', f.sourceType);
  if (f.status) params.set('status', f.status);
  if (f.mine) params.set('mine', 'true');
  if (f.saved) params.set('saved', 'true');
  if (f.trending) params.set('trending', 'true');
  if (f.cursor) params.set('cursor', f.cursor);
  if (f.page) params.set('page', String(f.page));
  if (f.limit) params.set('limit', String(f.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Tải file lên kho lưu trữ thất bại (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi kết nối khi tải file lên S3/MinIO'));
    };

    xhr.send(file);
  });
}

export const useResources = (f: ResourceQueryFilter = {}, enabled = true) =>
  useQuery<Resource[]>({
    queryKey: ['resources', f],
    enabled,
    queryFn: async () => {
      if (USE_MOCK) return mockApi.listResources(f);
      return apiClient<Resource[]>(`/resources${buildResourceQueryString(f)}`);
    },
  });

export const useResourcesPaginated = (f: ResourceQueryFilter = {}, enabled = true) =>
  useQuery<{ items: Resource[]; meta?: ApiResponseMeta }>({
    queryKey: ['resources-paginated', f],
    enabled,
    queryFn: async () => {
      if (USE_MOCK) {
        const items = await mockApi.listResources(f);
        return {
          items,
          meta: {
            page: f.page ?? 1,
            limit: f.limit ?? 20,
            total: items.length,
            hasNext: false,
          },
        };
      }
      const res = await apiClientWithMeta<Resource[]>(`/resources${buildResourceQueryString(f)}`);
      return { items: res.data, meta: res.meta };
    },
  });

export const useResourceDetail = (id: string) =>
  useQuery<Resource | undefined>({
    queryKey: ['resource', id],
    enabled: !!id,
    queryFn: async () => {
      if (USE_MOCK) return mockApi.getResource(id);
      return apiClient<Resource>(`/resources/${id}`);
    },
  });

// Alias for backwards compatibility
export const useResource = useResourceDetail;

export const useDownloadResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (USE_MOCK) {
        return {
          downloadUrl: '#',
          expiresIn: 300,
          isExternal: false,
          fileName: 'mock-resource.pdf',
        };
      }
      return apiClient<{
        downloadUrl: string;
        expiresIn: number | null;
        isExternal: boolean;
        fileName: string;
      }>(`/resources/${id}/download`);
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['resource', id] });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
    },
  });
};

export const usePresignUpload = () =>
  useMutation({
    mutationFn: async (input: PresignUploadRequest) => {
      return apiClient<PresignUploadResponse>('/resources/presign-upload', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  });

export const useContributeResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateResourceBody) => {
      if (USE_MOCK) {
        return mockApi.contributeResource({
          title: input.title,
          description: input.description,
          topic: input.topic,
          type: input.type,
          language: input.language,
          fileUrl: input.url || input.fileUrl || input.fileKey || '',
          tags: Array.isArray(input.tags) ? input.tags.join(', ') : input.tags || '',
          author: 'Sinh viên',
        });
      }
      return apiClient<Resource>('/resources', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
};

export const useBookmarks = (enabled = true) =>
  useQuery<Resource[]>({
    queryKey: ['resource-bookmarks'],
    enabled,
    queryFn: async () => {
      if (USE_MOCK) return [];
      return apiClient<Resource[]>('/resources/bookmarks');
    },
  });

export const useToggleBookmark = (resourceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiClient<{ resourceId: string; bookmarked: boolean }>(
        `/resources/${resourceId}/bookmark`,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', resourceId] });
      qc.invalidateQueries({ queryKey: ['resource-bookmarks'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
    },
  });
};

export const useResourceReviews = (resourceId: string) =>
  useQuery<ResourceComment[]>({
    queryKey: ['resource-comments', resourceId],
    enabled: !!resourceId,
    queryFn: async () => {
      if (USE_MOCK) return mockApi.listComments(resourceId);
      return apiClient<ResourceComment[]>(`/resources/${resourceId}/reviews`);
    },
  });

// Alias for backwards compatibility
export const useResourceComments = useResourceReviews;

export const useAddComment = (resourceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      author?: string;
      userRole?: string;
      content: string;
      rating?: number;
      parentId?: string;
    }) => {
      if (USE_MOCK) {
        return mockApi.addComment(resourceId, {
          author: data.author || 'Người dùng',
          userRole: data.userRole,
          content: data.content,
          rating: data.rating,
          parentId: data.parentId,
        });
      }
      return apiClient<ResourceComment>(`/resources/${resourceId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          content: data.content,
          rating: data.parentId ? undefined : data.rating,
          parentId: data.parentId,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-comments', resourceId] });
      qc.invalidateQueries({ queryKey: ['resource', resourceId] });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
    },
  });
};

export const useReportResource = () =>
  useMutation({
    mutationFn: async ({ id, reason, detail }: { id: string; reason: string; detail: string }) => {
      if (USE_MOCK) return mockApi.reportResource(id, reason, detail);
      return apiClient(`/resources/${id}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason, detail }),
      });
    },
  });

// ==========================================
// Moderator / Admin Hooks
// ==========================================

export const useAdminResources = (status = 'PENDING', enabled = true) =>
  useQuery<Resource[]>({
    queryKey: ['admin-resources', status],
    enabled,
    queryFn: async () => {
      return apiClient<Resource[]>(`/admin/resources?status=${encodeURIComponent(status)}`);
    },
  });

export const useApproveResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<Resource>(`/admin/resources/${id}/approve`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
    },
  });
};

export const useRejectResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiClient<Resource>(`/admin/resources/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources-paginated'] });
    },
  });
};

export const useAdminReports = (enabled = true) =>
  useQuery<ResourceReportItem[]>({
    queryKey: ['admin-reports'],
    enabled,
    queryFn: async () => {
      return apiClient<ResourceReportItem[]>('/admin/resources/reports');
    },
  });

export const useResolveReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      return apiClient(`/admin/resources/reports/${reportId}/resolve`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
};

export const useAdminStats = (enabled = true) =>
  useQuery<AdminModerationStats>({
    queryKey: ['admin-stats'],
    enabled,
    queryFn: async () => {
      return apiClient<AdminModerationStats>('/admin/resources/stats');
    },
  });
