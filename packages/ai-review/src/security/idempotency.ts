import crypto from 'node:crypto';
import type { Prisma } from '@ai-review/prisma-client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedStudentRequest, LoggerPort } from '../contracts/ports.js';
import type { AiReviewPrismaClient } from '../db/client.js';
import type { AuditService } from './audit.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function computeRequestHash(method: string, path: string, body: unknown): string {
  const canonical = JSON.stringify({
    method: method.toUpperCase(),
    path,
    body: canonicalize(body ?? null),
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function isValidIdempotencyKey(key: string): boolean {
  return UUID_RE.test(key);
}

export type AcquireIdempotencyResult =
  | { state: 'ACQUIRED' }
  | { state: 'REPLAY'; httpStatus: number; responseJson: unknown }
  | { state: 'CONFLICT' }
  | { state: 'IN_PROGRESS' };

export class IdempotencyService {
  constructor(
    private readonly prisma: AiReviewPrismaClient,
    private readonly ttlMs: number = DEFAULT_IDEMPOTENCY_TTL_MS,
    private readonly nowFn: () => Date = () => new Date()
  ) {}

  async acquire(
    userId: string,
    key: string,
    requestHash: string
  ): Promise<AcquireIdempotencyResult> {
    const now = this.nowFn();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    return this.prisma.$transaction(async (tx) => {
      // Xoá bản ghi đã hết hạn (nếu có) trước khi chiếm khoá
      await tx.idempotencyKey.deleteMany({
        where: {
          userId,
          key,
          expiresAt: { lte: now },
        },
      });

      const inserted = await tx.$queryRaw<Array<{ key: string }>>`
        INSERT INTO "ai_review"."idempotency_keys" (
          "user_id", "key", "request_hash", "status", "expires_at", "created_at", "updated_at"
        )
        VALUES (${userId}, ${key}, ${requestHash}, 'IN_PROGRESS', ${expiresAt}, ${now}, ${now})
        ON CONFLICT ("user_id", "key") DO NOTHING
        RETURNING "key"
      `;

      if (inserted.length === 1) {
        return { state: 'ACQUIRED' as const };
      }

      const existing = await tx.idempotencyKey.findUnique({
        where: { userId_key: { userId, key } },
      });

      if (!existing) {
        return { state: 'IN_PROGRESS' as const };
      }

      if (existing.requestHash !== requestHash) {
        return { state: 'CONFLICT' as const };
      }

      if (existing.status === 'COMPLETED') {
        return {
          state: 'REPLAY' as const,
          httpStatus: existing.httpStatus ?? 200,
          responseJson: existing.responseJson,
        };
      }

      return { state: 'IN_PROGRESS' as const };
    });
  }

  async complete(
    userId: string,
    key: string,
    httpStatus: number,
    responseJson: unknown
  ): Promise<void> {
    await this.prisma.idempotencyKey.updateMany({
      where: { userId, key, status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED',
        httpStatus,
        responseJson: responseJson as Prisma.InputJsonValue,
        updatedAt: this.nowFn(),
      },
    });
  }

  async release(userId: string, key: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { userId, key, status: 'IN_PROGRESS' },
    });
  }

  async purgeExpired(): Promise<number> {
    const res = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: this.nowFn() } },
    });
    return res.count;
  }

  async clearByUser(userId: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({ where: { userId } });
  }
}

export interface IdempotencyMiddlewareOptions {
  service: IdempotencyService;
  auditService?: AuditService;
  logger?: LoggerPort;
  resource?: string;
}

/**
 * Enforces mandatory UUID `Idempotency-Key` header on mutating POST endpoints.
 * Must run BEFORE `requireQuota` so replayed requests never consume quota twice.
 */
export function requireIdempotencyKey(options: IdempotencyMiddlewareOptions): RequestHandler {
  const { service, auditService, logger, resource = 'exam_set' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const student = (req as AuthenticatedStudentRequest).aiReviewStudent;
    if (!student?.userId) {
      return res.status(401).json({
        data: null,
        error: {
          message: 'Yêu cầu đăng nhập',
          code: 'UNAUTHORIZED',
          status: 401,
        },
      });
    }

    const rawKey = req.headers['idempotency-key'];
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!key) {
      return res.status(400).json({
        data: null,
        error: {
          message: 'Thiếu header Idempotency-Key (UUID bắt buộc cho thao tác tạo mới)',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          status: 400,
        },
      });
    }

    if (!isValidIdempotencyKey(key)) {
      return res.status(400).json({
        data: null,
        error: {
          message: 'Header Idempotency-Key phải đúng định dạng UUID',
          code: 'INVALID_IDEMPOTENCY_KEY',
          status: 400,
        },
      });
    }

    const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
    const requestHash = computeRequestHash(req.method, `${req.baseUrl}${req.path}`, req.body);

    try {
      const decision = await service.acquire(student.userId, key, requestHash);

      if (decision.state === 'CONFLICT') {
        await auditService?.recordSafe({
          actorType: 'student',
          userId: student.userId,
          action: 'security.idempotency_conflict',
          resource,
          outcome: 'DENY',
          requestId: reqId,
          meta: { idempotencyKey: key },
        });
        return res.status(409).json({
          data: null,
          error: {
            message: 'Idempotency-Key đã được dùng cho một payload khác',
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            status: 409,
          },
        });
      }

      if (decision.state === 'IN_PROGRESS') {
        res.setHeader('Retry-After', '2');
        return res.status(409).json({
          data: null,
          error: {
            message: 'Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng thử lại sau giây lát.',
            code: 'IDEMPOTENCY_IN_PROGRESS',
            status: 409,
          },
        });
      }

      if (decision.state === 'REPLAY') {
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(decision.httpStatus).json(decision.responseJson);
      }

      // ACQUIRED: intercept res.json to persist COMPLETED response atomically before sending
      const originalJson = res.json.bind(res);
      let finalized = false;

      res.json = ((payload: unknown) => {
        res.json = originalJson;
        finalized = true;
        const statusCode = res.statusCode;

        const finishPromise =
          statusCode >= 200 && statusCode < 300
            ? service.complete(student.userId, key, statusCode, payload)
            : service.release(student.userId, key);

        finishPromise
          .catch((err) => {
            logger?.error({ err, resource }, 'Failed to finalize idempotency key state');
          })
          .finally(() => {
            originalJson(payload);
          });

        return res;
      }) as Response['json'];

      res.once('close', () => {
        if (!finalized) {
          service.release(student.userId, key).catch((err) => {
            logger?.error({ err, resource }, 'Failed to release aborted idempotency key');
          });
        }
      });

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
