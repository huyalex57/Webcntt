import type {
  Level,
  PracticeAttemptSummary,
  QuestionDifficulty,
  QuestionType,
  SkillProfile,
  SubmitPracticeAttemptResponse,
  Topic,
} from '@devstudy/shared';

export interface PlayablePracticeQuestion {
  id: string;
  topic: Topic;
  level: Level;
  type: QuestionType;
  difficulty: QuestionDifficulty | string;
  prompt: string;
  code?: string | null;
  options: string[];
  tags?: string[];
  estimatedTimeSec?: number;
  reason?: string;
  /** Present only in offline mock mode; real APIs omit answers until server-side grading */
  correctIndex?: number;
  explanation?: string;
}

export interface ActivePracticeSession {
  id: string;
  source: 'practice_bank' | 'llm' | 'hybrid' | 'rule_based' | 'mock';
  title: string;
  topic?: Topic;
  level?: Level;
  examSetId?: string;
  modelId?: string | null;
  rationale?: string | null;
  warnings?: string[];
  questions: PlayablePracticeQuestion[];
  startedAt: string;
}

export interface AiReviewStatusDto {
  enabled: boolean;
  module?: string;
  contractVersion?: number;
  provider?: string;
  timezone?: string;
  status?: string;
}

export interface QuotaMetricDetailDto {
  metric: 'exam_sets' | 'llm_tokens';
  period: 'daily' | 'monthly';
  periodKey: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt: string;
}

export interface AiReviewQuotaSnapshotDto {
  plan: 'FREE' | 'PREMIUM';
  timezone: string;
  subscriptionStartedAt: string;
  quotas: {
    exam_sets: QuotaMetricDetailDto;
    llm_tokens: QuotaMetricDetailDto;
  };
}

export interface AiReviewRoadmapTopicDto {
  id: string;
  roadmap_slug: string;
  title: string;
  summary: string | null;
  year: number | null;
  resource_format: string | null;
  related_tags: string[];
  source_url: string;
  attribution: string;
}

export interface TopicMasteryDto {
  topic: Topic;
  mastery: number;
  weakness: number;
  confidence: number;
  confidenceLabel: 'none' | 'low' | 'medium' | 'high';
  answered: number;
  correct: number;
  rawAccuracy: number | null;
  isWeak: boolean;
  recommendedDifficulty: QuestionDifficulty;
}

export interface AiReviewRecommendationDto {
  generated_at: string;
  source: 'rule_based';
  cold_start: boolean;
  total_answers_analyzed: number;
  weak_topics: Topic[];
  spaced_review_due_count: number;
  recommended_next_topics: Topic[];
  recommended_difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  recommended_roadmaps: AiReviewRoadmapTopicDto[];
  masteries: TopicMasteryDto[];
}

export interface AiReviewExamSetCreateRequest {
  goal: string;
  topics?: Topic[];
  roadmap_topic_ids?: string[];
  num_questions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
  exclude_recent_days?: number;
  use_ai?: boolean;
}

export interface AiReviewExamSetCreatedDto {
  exam_set_id: string;
  source: 'llm' | 'hybrid' | 'rule_based';
  model_id?: string | null;
  rationale?: string | null;
  requested: number;
  fulfilled: number;
  rejected_ids: Array<{ id: string; reason: string }>;
  filled_by_fallback: number;
  warnings: string[];
  created_at: string;
  quota?: {
    metric: string;
    limit: number | null;
    remaining: number | null;
    reset_at: string;
  };
}

export interface AiReviewExamSetDetailItemDto {
  position: number;
  question_id: string;
  topic: Topic;
  difficulty: 'easy' | 'medium' | 'hard';
  reason: string;
  level?: Level;
  type?: QuestionType;
  prompt?: string;
  code?: string | null;
  options?: string[];
  tags?: string[];
  estimated_time_sec?: number;
}

export interface AiReviewExamSetDetailDto {
  exam_set_id: string;
  goal: string;
  source: 'llm' | 'hybrid' | 'rule_based';
  rationale: string | null;
  requested: number;
  fulfilled: number;
  rejected_count: number;
  filled_by_fallback: number;
  status: string;
  created_at: string;
  items: AiReviewExamSetDetailItemDto[];
}

export interface AiReviewExamSetListItemDto {
  exam_set_id: string;
  goal: string;
  source: 'llm' | 'hybrid' | 'rule_based';
  requested: number;
  fulfilled: number;
  rejected_count: number;
  filled_by_fallback: number;
  status: string;
  created_at: string;
}

export interface AiReviewSummaryRequest {
  goal?: string;
  topics?: Topic[];
  roadmap_topic_ids?: string[];
}

export interface AiReviewSummaryDto {
  generated_at: string;
  source: 'llm' | 'rule_based';
  model_id: string | null;
  fallback_reason: string | null;
  summary: string;
  weakness_insights: Array<{
    topic: Topic;
    diagnosis: string;
    action_step: string;
  }>;
  study_plan: Array<{
    step: number;
    title: string;
    focus_topics: Topic[];
    roadmap_topic_id?: string;
    reference_url?: string;
    estimated_minutes: number;
  }>;
  weak_topics: Topic[];
  recommended_next_topics: Topic[];
  recommended_difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  spaced_review_due_count: number;
  recommended_roadmaps: AiReviewRoadmapTopicDto[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  warnings: string[];
}

export interface ApiQuotaErrorShape {
  message?: string;
  code?: string;
  status?: number;
  details?: {
    metric?: string;
    plan?: string;
    period?: string;
    limit?: number | null;
    used?: number;
    remaining?: number;
    reset_at?: string;
    retry_after_seconds?: number;
  };
}

export type { PracticeAttemptSummary, SkillProfile, SubmitPracticeAttemptResponse };
