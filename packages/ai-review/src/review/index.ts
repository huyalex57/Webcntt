export {
  AiReviewService,
  type AiAssistedExamSetResult,
  type AiReviewServiceOptions,
  type AiReviewSummaryResult,
} from './ai-review.service.js';

export { buildDeterministicReviewSummary } from './fallback.js';

export {
  AI_EXAM_RANKING_OUTPUT_SCHEMA,
  AI_REVIEW_SUMMARY_OUTPUT_SCHEMA,
  AI_REVIEW_SUMMARY_REQUEST_SCHEMA,
  SYSTEM_BOUNDARY_CANARY,
  TRUSTED_REFERENCE_HOSTS,
  cleanLlmJson,
  detectInjectionSignals,
  guardExamRankingOutput,
  guardReviewSummaryOutput,
  isAllowedReferenceUrl,
  sanitizeUntrustedText,
  scanOutputForLeaks,
  wrapUntrustedData,
  type AiExamRankingOutputPayload,
  type AiReviewSummaryOutputPayload,
  type AiReviewSummaryRequestPayload,
  type OutputGuardResult,
  type StudyPlanStepDto,
  type WeaknessInsightDto,
} from './prompt-guard.js';

export {
  buildExamSetRankingPrompt,
  buildReviewSummaryPrompt,
  type CandidateQuestionPromptItem,
} from './prompts.js';
