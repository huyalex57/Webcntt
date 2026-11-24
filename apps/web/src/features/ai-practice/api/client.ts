import type {
  Level,
  PracticeAttemptSummary,
  PracticeQuestionItem,
  QuestionType,
  SkillProfile,
  SubmitPracticeAttemptRequest,
  SubmitPracticeAttemptResponse,
  Topic,
} from '@devstudy/shared';
import { apiClient } from '../../../lib/api-client';
import type {
  AiReviewExamSetCreateRequest,
  AiReviewExamSetCreatedDto,
  AiReviewExamSetDetailDto,
  AiReviewExamSetListItemDto,
  AiReviewQuotaSnapshotDto,
  AiReviewRecommendationDto,
  AiReviewStatusDto,
  AiReviewSummaryDto,
  AiReviewSummaryRequest,
} from './types';

function generateIdempotencyUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==========================================
// Core Practice Bank & Attempts API (/api/v1/practice/*)
// ==========================================

export async function fetchPracticeQuestions(params: {
  topic?: Topic;
  level?: Level;
  type?: QuestionType;
  limit?: number;
}): Promise<PracticeQuestionItem[]> {
  const qs = new URLSearchParams();
  if (params.topic) qs.set('topic', params.topic);
  if (params.level) qs.set('level', params.level);
  if (params.type) qs.set('type', params.type);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiClient<PracticeQuestionItem[]>(`/practice/questions${query ? `?${query}` : ''}`);
}

export async function submitPracticeAttempt(
  payload: SubmitPracticeAttemptRequest
): Promise<SubmitPracticeAttemptResponse> {
  return apiClient<SubmitPracticeAttemptResponse>('/practice/attempts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchPracticeSkillProfiles(): Promise<SkillProfile[]> {
  return apiClient<SkillProfile[]>('/practice/skill-profiles');
}

export async function fetchPracticeAttempts(limit: number = 10): Promise<PracticeAttemptSummary[]> {
  return apiClient<PracticeAttemptSummary[]>(`/practice/attempts?limit=${limit}`);
}

// ==========================================
// Plug-and-Play AI Review & Roadmap API (/api/v1/ai-review/*)
// ==========================================

/**
 * Probes whether @devstudy/ai-review is enabled on the backend.
 * Returns `{ enabled: false }` cleanly on 404 or network failure (plug-and-play safe).
 */
export async function probeAiReviewStatus(): Promise<AiReviewStatusDto> {
  try {
    const res = await apiClient<AiReviewStatusDto>('/ai-review/status');
    return { ...res, enabled: Boolean(res?.enabled) };
  } catch {
    return { enabled: false };
  }
}

export async function fetchAiReviewQuota(): Promise<AiReviewQuotaSnapshotDto> {
  return apiClient<AiReviewQuotaSnapshotDto>('/ai-review/quota');
}

export async function fetchAiReviewRecommendations(): Promise<AiReviewRecommendationDto> {
  return apiClient<AiReviewRecommendationDto>('/ai-review/recommendations');
}

export async function fetchAiReviewExamSets(
  limit: number = 10
): Promise<AiReviewExamSetListItemDto[]> {
  return apiClient<AiReviewExamSetListItemDto[]>(`/ai-review/exam-sets?limit=${limit}`);
}

export async function fetchAiReviewExamSetDetail(
  examSetId: string
): Promise<AiReviewExamSetDetailDto> {
  return apiClient<AiReviewExamSetDetailDto>(
    `/ai-review/exam-sets/${encodeURIComponent(examSetId)}`
  );
}

export async function createAiReviewExamSet(
  payload: AiReviewExamSetCreateRequest
): Promise<AiReviewExamSetCreatedDto> {
  return apiClient<AiReviewExamSetCreatedDto>('/ai-review/exam-sets', {
    method: 'POST',
    headers: {
      'Idempotency-Key': generateIdempotencyUuid(),
    },
    body: JSON.stringify(payload),
  });
}

export async function generateAiReviewSummary(
  payload: AiReviewSummaryRequest
): Promise<AiReviewSummaryDto> {
  return apiClient<AiReviewSummaryDto>('/ai-review/summary', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
