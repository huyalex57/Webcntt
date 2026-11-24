import type { Express } from 'express';
import type {
  AiReviewHostPorts,
  AiReviewModuleInstance,
  LLMProvider,
} from '@devstudy/ai-review';
import { logger } from '../../config/logger.js';
import { registerQuotaDelegate } from '../../middlewares/checkQuota.js';
import { createAuthAdapter } from './adapters/auth.adapter.js';
import { createAttemptHistoryAdapter } from './adapters/attempt-history.adapter.js';
import { createEventBusAdapter } from './adapters/event-bus.adapter.js';
import { createPlanResolverAdapter } from './adapters/plan-resolver.adapter.js';
import { createQuestionPoolAdapter } from './adapters/question-pool.adapter.js';
import { createStudentDirectoryAdapter } from './adapters/student-directory.adapter.js';

export const HOST_AI_REVIEW_CONTRACT_VERSION = 1;

export function createAiReviewHostPorts(
  contractVersion: number = HOST_AI_REVIEW_CONTRACT_VERSION
): AiReviewHostPorts {
  return {
    contractVersion,
    auth: createAuthAdapter(),
    studentDirectory: createStudentDirectoryAdapter(),
    planResolver: createPlanResolverAdapter(),
    attemptHistory: createAttemptHistoryAdapter(),
    questionPool: createQuestionPoolAdapter(),
    eventBus: createEventBusAdapter(),
  };
}

export interface MountAiReviewOptions {
  envSource?: NodeJS.ProcessEnv;
  contractVersion?: number;
  replaceCoreAiQuota?: boolean;
  llmProvider?: LLMProvider;
  fetchFn?: typeof fetch;
}

/**
 * Conditionally loads and mounts @devstudy/ai-review onto `/api/v1/ai-review`.
 * - When AI_REVIEW_ENABLED !== 'true', does NOT import the package and returns null.
 * - On major contract version mismatch, logs an error and returns null so core stays healthy.
 * - On invalid AI_REVIEW_* config when enabled, fails fast by throwing AiReviewConfigError.
 */
export async function mountAiReviewModule(
  app: Express,
  options: MountAiReviewOptions = {}
): Promise<AiReviewModuleInstance | null> {
  const envSource = options.envSource ?? process.env;
  if (envSource.AI_REVIEW_ENABLED !== 'true') {
    return null;
  }

  const aiReviewPkg = await import('@devstudy/ai-review');
  const ports = createAiReviewHostPorts(options.contractVersion);

  let mod: AiReviewModuleInstance;
  try {
    mod = aiReviewPkg.createAiReviewModule({
      ports,
      envSource,
      llmProvider: options.llmProvider,
      fetchFn: options.fetchFn,
    });
  } catch (err) {
    if (err instanceof aiReviewPkg.ContractVersionMismatchError) {
      logger.error(
        {
          expectedMajor: err.expectedMajor,
          receivedVersion: err.receivedVersion,
        },
        'Refusing to start @devstudy/ai-review due to contract version mismatch; core continues normally'
      );
      return null;
    }
    throw err;
  }

  await mod.start();
  app.use('/api/v1/ai-review', mod.publicRouter);

  const shouldReplaceCoreQuota = options.replaceCoreAiQuota !== false;
  if (shouldReplaceCoreQuota) {
    const aiQuotaHandler = mod.requireQuota('exam_sets', 1);
    registerQuotaDelegate((feature) => (feature === 'ai_questions' ? aiQuotaHandler : null));
  }

  const originalStop = mod.stop.bind(mod);
  return {
    ...mod,
    async stop() {
      if (shouldReplaceCoreQuota) {
        registerQuotaDelegate(null);
      }
      await originalStop();
    },
  };
}
