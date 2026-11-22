import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CodeLanguage,
  CodeQuotaInfo,
  CodeSnippet,
  LanguageInfo,
  RunResult,
} from '@devstudy/shared';
import { apiClient } from '../../../lib/api-client';
import * as mockApi from '../../../lib/api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const useLanguages = () =>
  useQuery<LanguageInfo[]>({
    queryKey: ['code-languages'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (USE_MOCK) return [];
      return apiClient<LanguageInfo[]>('/code/languages');
    },
  });

export const useCodeQuota = (enabled = true) =>
  useQuery<CodeQuotaInfo>({
    queryKey: ['code-quota'],
    enabled: enabled && !USE_MOCK,
    queryFn: async () => apiClient<CodeQuotaInfo>('/code/quota'),
  });

export const useRunCode = () => {
  const qc = useQueryClient();
  return useMutation<
    RunResult,
    any,
    { code: string; language: CodeLanguage; languageId?: string; stdin: string }
  >({
    mutationFn: async (v) => {
      if (USE_MOCK) {
        return mockApi.runCode(v.code, v.language, v.stdin);
      }
      return apiClient<RunResult>('/code/run', {
        method: 'POST',
        body: JSON.stringify({
          code: v.code,
          language: v.language,
          languageId: v.languageId,
          stdin: v.stdin,
        }),
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['code-quota'] });
    },
  });
};

export const useSnippets = (enabled = true) =>
  useQuery<CodeSnippet[]>({
    queryKey: ['snippets'],
    enabled,
    queryFn: async () => {
      if (USE_MOCK) return mockApi.listSnippets();
      return apiClient<CodeSnippet[]>('/code/snippets');
    },
  });

export const useSnippet = (id: string | null) =>
  useQuery<CodeSnippet>({
    queryKey: ['snippet', id],
    enabled: Boolean(id) && !USE_MOCK,
    queryFn: async () => apiClient<CodeSnippet>(`/code/snippets/${id}`),
  });

export const useSaveSnippet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: {
      title: string;
      language: CodeLanguage;
      languageId?: string;
      code: string;
      isPublic?: boolean;
      lastRunStatus?: CodeSnippet['lastRunStatus'];
    }) => {
      if (USE_MOCK) {
        return mockApi.saveSnippet({
          id: `sn-${Date.now()}`,
          title: s.title,
          language: s.language,
          code: s.code,
          createdAt: new Date().toISOString().slice(0, 10),
          lastRunStatus: s.lastRunStatus ?? undefined,
        });
      }
      return apiClient<CodeSnippet>('/code/snippets', {
        method: 'POST',
        body: JSON.stringify(s),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
};

export const useDeleteSnippet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<{ id: string; deleted: boolean }>(`/code/snippets/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
};
