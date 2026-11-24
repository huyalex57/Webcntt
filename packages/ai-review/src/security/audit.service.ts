import type { Prisma } from '@ai-review/prisma-client';
import type { LoggerPort } from '../contracts/ports.js';
import type { AiReviewPrismaClient } from '../db/client.js';

export type AuditActorType = 'student' | 'ai_service' | 'system';
export type AuditOutcome = 'ALLOW' | 'DENY' | 'ERROR';

export interface RecordAuditEventInput {
  actorType: AuditActorType;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  outcome: AuditOutcome;
  requestId?: string | null;
  tokenJti?: string | null;
  meta?: Record<string, unknown>;
}

const FORBIDDEN_META_KEYS = new Set([
  'email',
  'studentid',
  'student_id',
  'displayname',
  'display_name',
  'fullname',
  'full_name',
  'university',
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'secret',
  'prompt',
  'messages',
]);

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const scrubbed = value
      .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
      .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
    return scrubbed.length > 300 ? `${scrubbed.slice(0, 300)}...` : scrubbed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_META_KEYS.has(k.toLowerCase())) {
        continue;
      }
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Strips forbidden PII/token keys and redacts embedded JWTs or emails before writing audit logs.
 */
export function sanitizeAuditMeta(
  meta?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  return sanitizeValue(meta, 0) as Prisma.InputJsonValue;
}

export class AuditService {
  constructor(
    private readonly prisma: AiReviewPrismaClient,
    private readonly logger: LoggerPort
  ) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        outcome: input.outcome,
        requestId: input.requestId ?? null,
        tokenJti: input.tokenJti ?? null,
        meta: sanitizeAuditMeta(input.meta),
      },
    });
  }

  /**
   * Non-throwing wrapper so transient audit write errors never leak secrets or crash responses.
   */
  async recordSafe(input: RecordAuditEventInput): Promise<void> {
    try {
      await this.record(input);
    } catch (err) {
      this.logger.error({ err, action: input.action, resource: input.resource }, 'Audit log write failed');
    }
  }

  async listByUser(userId: string, limit: number = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.auditEvent.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
  }
}
