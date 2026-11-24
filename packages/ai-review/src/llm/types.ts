export type LLMProviderErrorCode =
  | 'LLM_TIMEOUT'
  | 'LLM_RATE_LIMITED'
  | 'LLM_AUTH_ERROR'
  | 'LLM_BAD_REQUEST'
  | 'LLM_UPSTREAM_ERROR'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_CONFIG_ERROR';

export interface LLMGenerateRequest {
  /** Trusted system instructions (never contains untrusted user/DB/roadmap text). */
  systemInstruction: string;
  /** User prompt with untrusted payloads wrapped in `<data untrusted="true">...</data>`. */
  userPrompt: string;
  /** Optional JSON Schema hint for structured JSON generation. */
  responseJsonSchema?: Record<string, unknown>;
  /** Maximum output tokens for this call (defaults to provider config). */
  maxOutputTokens?: number;
  /** Sampling temperature (defaults to low deterministic 0.2). */
  temperature?: number;
  /** Per-call timeout override in milliseconds. */
  timeoutMs?: number;
  /** Correlation request ID for observability (never PII). */
  requestId?: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMGenerateResponse {
  text: string;
  modelId: string;
  provider: string;
  usage: LLMUsage;
  latencyMs: number;
  finishReason?: string;
}

export class LLMProviderError extends Error {
  readonly code: LLMProviderErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly provider: string;

  constructor(params: {
    message: string;
    code: LLMProviderErrorCode;
    provider: string;
    retryable: boolean;
    httpStatus?: number;
  }) {
    super(params.message);
    this.name = 'LLMProviderError';
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = params.retryable;
    this.httpStatus = params.httpStatus;
  }
}

/**
 * Provider-agnostic interface so @devstudy/ai-review can swap models or LLM vendors
 * (Gemini, OpenAI, Anthropic, local, Fake) solely through configuration without touching business logic.
 */
export interface LLMProvider {
  readonly name: string;
  readonly modelId: string;
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>;
}

/**
 * Conservative character-based token estimate (~3.5 chars/token for mixed VI/EN/JSON)
 * used for pre-flight monthly token budget checks and fallback accounting when metadata is omitted.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.5));
}
