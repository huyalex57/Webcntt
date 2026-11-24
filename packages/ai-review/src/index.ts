export {
  createAiReviewModule,
  type AiReviewModuleInstance,
  type CreateAiReviewModuleOptions,
} from './module.js';

export {
  AiReviewConfigError,
  isAiReviewEnabled,
  loadAiReviewConfig,
  type AiReviewConfig,
} from './config.js';

export {
  AI_REVIEW_REDACT_PATHS,
  createModuleLogger,
  type ModuleLoggerOptions,
} from './logging.js';

export type { ModuleHealthResult } from './routes/public.js';

export * from './llm/index.js';
export * from './quota/index.js';
export * from './recommender/index.js';
export * from './review/index.js';
export * from './roadmap/index.js';
export * from './security/index.js';
export * from './contracts/index.js';
