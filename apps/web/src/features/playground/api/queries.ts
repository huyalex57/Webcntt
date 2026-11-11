import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSnippets, runCode, saveSnippet } from '../../../lib/api';
import type { CodeLanguage, CodeSnippet } from '@devstudy/shared';

export const useRunCode = () =>
  useMutation({
    mutationFn: (v: { code: string; language: CodeLanguage; stdin: string }) =>
      runCode(v.code, v.language, v.stdin),
  });

export const useSnippets = () =>
  useQuery({
    queryKey: ['snippets'],
    queryFn: listSnippets,
  });

export const useSaveSnippet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: CodeSnippet) => saveSnippet(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
};
