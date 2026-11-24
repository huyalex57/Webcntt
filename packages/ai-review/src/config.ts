import crypto from 'node:crypto';
import { z } from 'zod';

export class AiReviewConfigError extends Error {
  readonly code = 'AI_REVIEW_CONFIG_INVALID';
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid @devstudy/ai-review configuration:\n- ${issues.join('\n- ')}`);
    this.name = 'AiReviewConfigError';
    this.issues = issues;
  }
}

export interface AiReviewConfig {
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly llmProvider: 'gemini' | 'fake';
  readonly llmModel: string;
  readonly llmApiKey: string;
  readonly llmBaseUrl: string;
  readonly llmTimeoutMs: number;
  readonly llmMaxOutputTokens: number;
  readonly llmMaxRetries: number;
  readonly timezone: string;
  readonly quotaFailMode: 'closed' | 'open';
  readonly tokenSecret: string;
  readonly rateLimitMax: number;
  readonly rateLimitWindowSec: number;
}

export function isAiReviewEnabled(envSource: NodeJS.ProcessEnv = process.env): boolean {
  return envSource.AI_REVIEW_ENABLED === 'true';
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateAiReviewDatabaseUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'AI_REVIEW_DATABASE_URL must be a valid PostgreSQL connection URL';
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return 'AI_REVIEW_DATABASE_URL must use postgresql:// or postgres:// protocol';
  }
  if (parsed.searchParams.get('schema') !== 'ai_review') {
    return 'AI_REVIEW_DATABASE_URL must explicitly set ?schema=ai_review to stay isolated from core';
  }
  return null;
}

const enabledConfigSchema = z
  .object({
    AI_REVIEW_ENABLED: z.literal('true'),
    AI_REVIEW_DATABASE_URL: z.string().min(1, 'AI_REVIEW_DATABASE_URL is required'),
    AI_REVIEW_LLM_PROVIDER: z.enum(['gemini', 'fake']).default('gemini'),
    // Bắt buộc truyền từ env — tuyệt đối KHÔNG đặt giá trị model mặc định cứng trong code
    AI_REVIEW_LLM_MODEL: z.string().trim().min(1, 'AI_REVIEW_LLM_MODEL is required (no hardcoded default)'),
    AI_REVIEW_LLM_API_KEY: z.string().default(''),
    AI_REVIEW_LLM_BASE_URL: z
      .string()
      .trim()
      .url('AI_REVIEW_LLM_BASE_URL must be a valid https/http URL')
      .default('https://generativelanguage.googleapis.com/v1beta'),
    AI_REVIEW_LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
    AI_REVIEW_LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(8192).default(1024),
    AI_REVIEW_LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
    AI_REVIEW_TIMEZONE: z.string().trim().min(1).default('Asia/Ho_Chi_Minh'),
    AI_REVIEW_QUOTA_FAIL_MODE: z.enum(['closed', 'open']).default('closed'),
    AI_REVIEW_TOKEN_SECRET: z
      .string()
      .min(32, 'AI_REVIEW_TOKEN_SECRET must be at least 32 characters when provided')
      .optional(),
    AI_REVIEW_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
    AI_REVIEW_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(1).max(3600).default(60),
  })
  .superRefine((val, ctx) => {
    const dbErr = validateAiReviewDatabaseUrl(val.AI_REVIEW_DATABASE_URL);
    if (dbErr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_REVIEW_DATABASE_URL'],
        message: dbErr,
      });
    }

    if (val.AI_REVIEW_LLM_PROVIDER === 'gemini' && val.AI_REVIEW_LLM_API_KEY.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_REVIEW_LLM_API_KEY'],
        message: 'AI_REVIEW_LLM_API_KEY is required when AI_REVIEW_LLM_PROVIDER=gemini',
      });
    }

    if (!isValidTimeZone(val.AI_REVIEW_TIMEZONE)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_REVIEW_TIMEZONE'],
        message: `AI_REVIEW_TIMEZONE "${val.AI_REVIEW_TIMEZONE}" is not a valid IANA timezone`,
      });
    }
  });

/**
 * Loads and validates @devstudy/ai-review config strictly from AI_REVIEW_* env variables.
 * Fails fast with AiReviewConfigError when AI_REVIEW_ENABLED=true and any required variable is invalid.
 */
export function loadAiReviewConfig(envSource: NodeJS.ProcessEnv = process.env): AiReviewConfig {
  if (!isAiReviewEnabled(envSource)) {
    return Object.freeze({
      enabled: false,
      databaseUrl: '',
      llmProvider: 'fake',
      llmModel: '',
      llmApiKey: '',
      llmBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      llmTimeoutMs: 20_000,
      llmMaxOutputTokens: 1024,
      llmMaxRetries: 1,
      timezone: 'Asia/Ho_Chi_Minh',
      quotaFailMode: 'closed',
      tokenSecret: '',
      rateLimitMax: 30,
      rateLimitWindowSec: 60,
    });
  }

  const parsed = enabledConfigSchema.safeParse({
    AI_REVIEW_ENABLED: envSource.AI_REVIEW_ENABLED,
    AI_REVIEW_DATABASE_URL: envSource.AI_REVIEW_DATABASE_URL,
    AI_REVIEW_LLM_PROVIDER: envSource.AI_REVIEW_LLM_PROVIDER || undefined,
    AI_REVIEW_LLM_MODEL: envSource.AI_REVIEW_LLM_MODEL,
    AI_REVIEW_LLM_API_KEY: envSource.AI_REVIEW_LLM_API_KEY ?? '',
    AI_REVIEW_LLM_BASE_URL: envSource.AI_REVIEW_LLM_BASE_URL || undefined,
    AI_REVIEW_LLM_TIMEOUT_MS: envSource.AI_REVIEW_LLM_TIMEOUT_MS || undefined,
    AI_REVIEW_LLM_MAX_OUTPUT_TOKENS: envSource.AI_REVIEW_LLM_MAX_OUTPUT_TOKENS || undefined,
    AI_REVIEW_LLM_MAX_RETRIES: envSource.AI_REVIEW_LLM_MAX_RETRIES || undefined,
    AI_REVIEW_TIMEZONE: envSource.AI_REVIEW_TIMEZONE || undefined,
    AI_REVIEW_QUOTA_FAIL_MODE: envSource.AI_REVIEW_QUOTA_FAIL_MODE || undefined,
    AI_REVIEW_TOKEN_SECRET: envSource.AI_REVIEW_TOKEN_SECRET || undefined,
    AI_REVIEW_RATE_LIMIT_MAX: envSource.AI_REVIEW_RATE_LIMIT_MAX || undefined,
    AI_REVIEW_RATE_LIMIT_WINDOW_SEC: envSource.AI_REVIEW_RATE_LIMIT_WINDOW_SEC || undefined,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new AiReviewConfigError(issues);
  }

  const d = parsed.data;
  return Object.freeze({
    enabled: true,
    databaseUrl: d.AI_REVIEW_DATABASE_URL,
    llmProvider: d.AI_REVIEW_LLM_PROVIDER,
    llmModel: d.AI_REVIEW_LLM_MODEL,
    llmApiKey: d.AI_REVIEW_LLM_API_KEY,
    llmBaseUrl: d.AI_REVIEW_LLM_BASE_URL.replace(/\/+$/, ''),
    llmTimeoutMs: d.AI_REVIEW_LLM_TIMEOUT_MS,
    llmMaxOutputTokens: d.AI_REVIEW_LLM_MAX_OUTPUT_TOKENS,
    llmMaxRetries: d.AI_REVIEW_LLM_MAX_RETRIES,
    timezone: d.AI_REVIEW_TIMEZONE,
    quotaFailMode: d.AI_REVIEW_QUOTA_FAIL_MODE,
    tokenSecret: d.AI_REVIEW_TOKEN_SECRET ?? crypto.randomBytes(32).toString('hex'),
    rateLimitMax: d.AI_REVIEW_RATE_LIMIT_MAX,
    rateLimitWindowSec: d.AI_REVIEW_RATE_LIMIT_WINDOW_SEC,
  });
}
