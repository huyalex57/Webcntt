import {
  LLMProviderError,
  estimateTokenCount,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMProvider,
} from './types.js';

export interface GeminiProviderOptions {
  apiKey: string;
  /** Model ID supplied strictly via AI_REVIEW_LLM_MODEL env (never hardcoded). */
  modelId: string;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  defaultMaxOutputTokens?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

interface GeminiRestResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrubSecret(text: string, secret: string): string {
  if (!text) return '';
  let cleaned = text;
  if (secret && secret.length >= 4) {
    cleaned = cleaned.split(secret).join('[REDACTED_API_KEY]');
  }
  return cleaned
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

function classifyHttpStatus(status: number): {
  code: LLMProviderError['code'];
  retryable: boolean;
} {
  if (status === 429) {
    return { code: 'LLM_RATE_LIMITED', retryable: true };
  }
  if (status === 401 || status === 403) {
    return { code: 'LLM_AUTH_ERROR', retryable: false };
  }
  if (status === 400 || status === 404 || status === 422) {
    return { code: 'LLM_BAD_REQUEST', retryable: false };
  }
  if (status >= 500) {
    return { code: 'LLM_UPSTREAM_ERROR', retryable: true };
  }
  return { code: 'LLM_UPSTREAM_ERROR', retryable: false };
}

/**
 * Gemini REST provider implementing `LLMProvider`.
 * - Reads `modelId` exclusively from configuration/env (no hardcoded model IDs).
 * - Sends `apiKey` strictly in the `x-goog-api-key` HTTP header (never in URL query string).
 * - Enforces timeout via AbortController and retries once (configurable) on transient failures.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxOutputTokens: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: GeminiProviderOptions) {
    const modelId = options.modelId.trim();
    const apiKey = options.apiKey.trim();
    if (!modelId) {
      throw new LLMProviderError({
        message: 'GeminiProvider requires non-empty modelId from AI_REVIEW_LLM_MODEL',
        code: 'LLM_CONFIG_ERROR',
        provider: 'gemini',
        retryable: false,
      });
    }
    if (!apiKey) {
      throw new LLMProviderError({
        message: 'GeminiProvider requires non-empty apiKey from AI_REVIEW_LLM_API_KEY',
        code: 'LLM_CONFIG_ERROR',
        provider: 'gemini',
        retryable: false,
      });
    }

    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/+$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 20_000;
    this.defaultMaxOutputTokens = options.defaultMaxOutputTokens ?? 1024;
    this.maxRetries = Math.min(Math.max(Math.trunc(options.maxRetries ?? 1), 0), 3);
    this.retryBaseDelayMs = Math.max(0, options.retryBaseDelayMs ?? 250);
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.sleepFn = options.sleepFn ?? defaultSleep;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startedAt = Date.now();
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const maxOutputTokens = request.maxOutputTokens ?? this.defaultMaxOutputTokens;
    const temperature = request.temperature ?? 0.2;

    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(this.modelId)}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
    };
    if (request.responseJsonSchema) {
      generationConfig.responseJsonSchema = request.responseJsonSchema;
    }

    const body = JSON.stringify({
      systemInstruction: {
        parts: [{ text: request.systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
      generationConfig,
    });

    let lastError: LLMProviderError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0 && this.retryBaseDelayMs > 0) {
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        await this.sleepFn(delay);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            ...(request.requestId ? { 'x-request-id': request.requestId } : {}),
          },
          body,
          signal: controller.signal,
        });

        const rawBody = await response.text();
        let parsed: GeminiRestResponse | null = null;
        try {
          parsed = rawBody ? (JSON.parse(rawBody) as GeminiRestResponse) : null;
        } catch {
          parsed = null;
        }

        if (!response.ok) {
          const { code, retryable } = classifyHttpStatus(response.status);
          const upstreamMsg = parsed?.error?.message
            ? scrubSecret(parsed.error.message, this.apiKey)
            : `HTTP ${response.status}`;

          lastError = new LLMProviderError({
            message: `Gemini API failed (${response.status}): ${upstreamMsg}`,
            code,
            provider: this.name,
            retryable,
            httpStatus: response.status,
          });

          if (!retryable || attempt >= this.maxRetries) {
            throw lastError;
          }
          continue;
        }

        const candidate = parsed?.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        const text = parts
          .map((p) => (typeof p.text === 'string' ? p.text : ''))
          .join('')
          .trim();

        if (!text) {
          lastError = new LLMProviderError({
            message: `Gemini API returned empty content (finishReason=${candidate?.finishReason ?? 'UNKNOWN'})`,
            code: 'LLM_EMPTY_RESPONSE',
            provider: this.name,
            retryable: false,
          });
          throw lastError;
        }

        const fallbackInputTokens = estimateTokenCount(
          `${request.systemInstruction}\n${request.userPrompt}`
        );
        const fallbackOutputTokens = estimateTokenCount(text);

        const inputTokens =
          typeof parsed?.usageMetadata?.promptTokenCount === 'number' &&
          parsed.usageMetadata.promptTokenCount >= 0
            ? Math.trunc(parsed.usageMetadata.promptTokenCount)
            : fallbackInputTokens;
        const outputTokens =
          typeof parsed?.usageMetadata?.candidatesTokenCount === 'number' &&
          parsed.usageMetadata.candidatesTokenCount >= 0
            ? Math.trunc(parsed.usageMetadata.candidatesTokenCount)
            : fallbackOutputTokens;
        const totalTokens =
          typeof parsed?.usageMetadata?.totalTokenCount === 'number' &&
          parsed.usageMetadata.totalTokenCount >= inputTokens + outputTokens
            ? Math.trunc(parsed.usageMetadata.totalTokenCount)
            : inputTokens + outputTokens;

        return {
          text,
          modelId: this.modelId,
          provider: this.name,
          usage: {
            inputTokens,
            outputTokens,
            totalTokens,
          },
          latencyMs: Math.max(0, Date.now() - startedAt),
          finishReason: candidate?.finishReason,
        };
      } catch (err) {
        if (err instanceof LLMProviderError) {
          lastError = err;
          if (!err.retryable || attempt >= this.maxRetries) {
            throw err;
          }
          continue;
        }

        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' || err.name === 'TimeoutError' || /abort/i.test(err.message));

        const safeMessage = scrubSecret(
          err instanceof Error ? err.message : String(err),
          this.apiKey
        );

        lastError = new LLMProviderError({
          message: isAbort
            ? `Gemini API timed out after ${timeoutMs}ms`
            : `Gemini API network error: ${safeMessage}`,
          code: isAbort ? 'LLM_TIMEOUT' : 'LLM_NETWORK_ERROR',
          provider: this.name,
          retryable: true,
        });

        if (attempt >= this.maxRetries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw (
      lastError ??
      new LLMProviderError({
        message: 'Gemini API request failed unexpectedly',
        code: 'LLM_UPSTREAM_ERROR',
        provider: this.name,
        retryable: false,
      })
    );
  }
}
