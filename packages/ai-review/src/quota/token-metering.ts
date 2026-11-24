import type { QuotaMetricStatus, QuotaService } from './quota.service.js';

export interface ActualLlmTokenUsage {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  requestId?: string;
  latencyMs?: number;
}

/**
 * Coordinates LLM token budget pre-flight checks and post-call actual metering.
 */
export class TokenMeteringService {
  constructor(private readonly quotaService: QuotaService) {}

  /**
   * Pre-flight gate before invoking LLM: throws QuotaExceededError (429)
   * if remaining monthly `llm_tokens` budget is below `estimatedTokens`.
   */
  async assertHasBudget(
    userId: string,
    estimatedTokens: number = 1
  ): Promise<QuotaMetricStatus> {
    const minRequired = Math.max(1, Math.trunc(estimatedTokens));
    return this.quotaService.assertAvailable(userId, 'llm_tokens', minRequired);
  }

  /**
   * Post-call metering: records exact `inputTokens + outputTokens` into
   * `usage_counters` and `usage_events` inside one atomic DB transaction.
   */
  async recordUsage(
    userId: string,
    usage: ActualLlmTokenUsage
  ): Promise<QuotaMetricStatus> {
    const inputTokens = Math.max(0, Math.trunc(usage.inputTokens));
    const outputTokens = Math.max(0, Math.trunc(usage.outputTokens));
    const totalTokens = inputTokens + outputTokens;

    return this.quotaService.recordActualUsage(userId, 'llm_tokens', totalTokens, {
      modelId: usage.modelId,
      requestId: usage.requestId,
      inputTokens,
      outputTokens,
      latencyMs: Math.max(0, Math.trunc(usage.latencyMs ?? 0)),
    });
  }
}
