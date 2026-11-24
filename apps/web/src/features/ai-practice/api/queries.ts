import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Level,
  PracticeSetRequest,
  QuestionType,
  SubmitPracticeAttemptRequest,
  Topic,
} from '@devstudy/shared';
import { generatePracticeSet } from '../../../lib/api';
import {
  createAiReviewExamSet,
  fetchAiReviewExamSetDetail,
  fetchAiReviewExamSets,
  fetchAiReviewQuota,
  fetchAiReviewRecommendations,
  fetchPracticeAttempts,
  fetchPracticeQuestions,
  fetchPracticeSkillProfiles,
  generateAiReviewSummary,
  probeAiReviewStatus,
  submitPracticeAttempt,
} from './client';
import type {
  AiReviewExamSetCreateRequest,
  AiReviewSummaryRequest,
} from './types';

export const practiceQueryKeys = {
  skillProfiles: ['practice', 'skill-profiles'] as const,
  attempts: ['practice', 'attempts'] as const,
  aiStatus: ['ai-review', 'status'] as const,
  aiQuota: ['ai-review', 'quota'] as const,
  aiRecommendations: ['ai-review', 'recommendations'] as const,
  aiExamSets: ['ai-review', 'exam-sets'] as const,
};

/** Legacy mock generator kept for VITE_USE_MOCK=true fallback */
export const useGeneratePracticeSet = () =>
  useMutation({
    mutationFn: (req: PracticeSetRequest) => generatePracticeSet(req),
  });

export const usePracticeSkillProfiles = (enabled: boolean, userId?: string | null) =>
  useQuery({
    queryKey: [...practiceQueryKeys.skillProfiles, userId ?? 'anon'],
    queryFn: fetchPracticeSkillProfiles,
    enabled,
    retry: false,
  });

export const usePracticeAttempts = (
  enabled: boolean,
  limit: number = 8,
  userId?: string | null
) =>
  useQuery({
    queryKey: [...practiceQueryKeys.attempts, limit, userId ?? 'anon'],
    queryFn: () => fetchPracticeAttempts(limit),
    enabled,
    retry: false,
  });

export const useLoadPracticeQuestions = () =>
  useMutation({
    mutationFn: (params: {
      topic?: Topic;
      level?: Level;
      type?: QuestionType;
      limit?: number;
    }) => fetchPracticeQuestions(params),
  });

export const useSubmitPracticeAttempt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitPracticeAttemptRequest) => submitPracticeAttempt(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: practiceQueryKeys.skillProfiles });
      qc.invalidateQueries({ queryKey: practiceQueryKeys.attempts });
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiRecommendations });
    },
  });
};

export const useAiReviewStatus = (enabled: boolean) =>
  useQuery({
    queryKey: practiceQueryKeys.aiStatus,
    queryFn: probeAiReviewStatus,
    enabled,
    staleTime: 60_000,
    retry: false,
  });

export const useAiReviewQuota = (enabled: boolean, userId?: string | null) =>
  useQuery({
    queryKey: [...practiceQueryKeys.aiQuota, userId ?? 'anon'],
    queryFn: fetchAiReviewQuota,
    enabled,
    retry: false,
  });

export const useAiReviewRecommendations = (enabled: boolean, userId?: string | null) =>
  useQuery({
    queryKey: [...practiceQueryKeys.aiRecommendations, userId ?? 'anon'],
    queryFn: fetchAiReviewRecommendations,
    enabled,
    retry: false,
  });

export const useAiReviewExamSets = (
  enabled: boolean,
  limit: number = 6,
  userId?: string | null
) =>
  useQuery({
    queryKey: [...practiceQueryKeys.aiExamSets, limit, userId ?? 'anon'],
    queryFn: () => fetchAiReviewExamSets(limit),
    enabled,
    retry: false,
  });

export const useCreateAndLoadAiExamSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AiReviewExamSetCreateRequest) => {
      const created = await createAiReviewExamSet(payload);
      const detail = await fetchAiReviewExamSetDetail(created.exam_set_id);
      return { created, detail };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiQuota });
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiExamSets });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiQuota });
    },
  });
};

export const useLoadAiExamSetDetail = () =>
  useMutation({
    mutationFn: (examSetId: string) => fetchAiReviewExamSetDetail(examSetId),
  });

export const useGenerateAiReviewSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiReviewSummaryRequest) => generateAiReviewSummary(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiQuota });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: practiceQueryKeys.aiQuota });
    },
  });
};
