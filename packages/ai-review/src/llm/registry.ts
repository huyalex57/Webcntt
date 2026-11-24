import type { AiReviewConfig } from '../config.js';
import { FakeProvider } from './fake.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { LLMProviderError, type LLMProvider } from './types.js';

export interface CreateLlmProviderOverrides {
  provider?: LLMProvider;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

/**
 * Factory creating the configured LLMProvider from `AiReviewConfig`.
 * Model ID is strictly taken from `config.llmModel` (from `AI_REVIEW_LLM_MODEL` env).
 */
export function createLlmProvider(
  config: AiReviewConfig,
  overrides: CreateLlmProviderOverrides = {}
): LLMProvider {
  if (overrides.provider) {
    return overrides.provider;
  }

  switch (config.llmProvider) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: config.llmApiKey,
        modelId: config.llmModel,
        baseUrl: config.llmBaseUrl,
        defaultTimeoutMs: config.llmTimeoutMs,
        defaultMaxOutputTokens: config.llmMaxOutputTokens,
        maxRetries: config.llmMaxRetries,
        fetchFn: overrides.fetchFn,
        sleepFn: overrides.sleepFn,
      });

    case 'fake':
      return new FakeProvider({
        modelId: config.llmModel,
      });

    default:
      throw new LLMProviderError({
        message: `Unsupported AI_REVIEW_LLM_PROVIDER: ${String(config.llmProvider)}`,
        code: 'LLM_CONFIG_ERROR',
        provider: String(config.llmProvider),
        retryable: false,
      });
  }
}
