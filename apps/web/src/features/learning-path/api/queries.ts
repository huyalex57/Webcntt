import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import type {
  GenerateLearningPathRequest,
  LearningPath,
  EvaluateMilestoneRequest,
  EvaluateMilestoneResponse,
} from '@devstudy/shared';

export function useCourseLearningPath(courseId: string) {
  return useQuery({
    queryKey: ['learning-path', courseId],
    queryFn: () => apiClient<LearningPath | null>(`/courses/${courseId}/learning-path`),
    enabled: !!courseId,
  });
}

export function useGenerateLearningPath(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateLearningPathRequest) =>
      apiClient<LearningPath>(`/courses/${courseId}/generate-path`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (newPath) => {
      qc.setQueryData(['learning-path', courseId], newPath);
      qc.invalidateQueries({ queryKey: ['learning-path', courseId] });
    },
  });
}

export function useEvaluateMilestone(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, answers }: { milestoneId: string; answers: Record<string, number> }) =>
      apiClient<EvaluateMilestoneResponse>(`/milestones/${milestoneId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ answers } as EvaluateMilestoneRequest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path', courseId] });
    },
  });
}

export function useCompleteRemediation(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (remediationId: string) =>
      apiClient<{ message: string }>(`/remediations/${remediationId}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path', courseId] });
    },
  });
}
