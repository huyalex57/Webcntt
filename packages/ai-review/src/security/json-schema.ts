import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { TopicCode } from '../contracts/events.js';
import type { AuthenticatedStudentRequest } from '../contracts/ports.js';
import type { AuditService } from './audit.service.js';
import examSetCreateSchema from './schemas/exam-set-create.v1.json';

export interface ExamSetCreatePayload {
  student_id?: string;
  goal: string;
  topics?: TopicCode[];
  roadmap_topic_ids?: string[];
  num_questions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  exam_ids?: string[];
  exclude_recent_days: number;
  rationale?: string;
  use_ai?: boolean;
}

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  useDefaults: true,
  removeAdditional: false,
  coerceTypes: false,
});

export const EXAM_SET_CREATE_SCHEMA = examSetCreateSchema;

const compiledExamSetValidator: ValidateFunction<ExamSetCreatePayload> =
  ajv.compile<ExamSetCreatePayload>(examSetCreateSchema);

export interface JsonSchemaValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Array<{ path: string; keyword: string; message: string }>;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((e) => ({
    path: e.instancePath || '/',
    keyword: e.keyword,
    message: e.message || 'Invalid value',
  }));
}

export function validateExamSetCreatePayload(
  raw: unknown
): JsonSchemaValidationResult<ExamSetCreatePayload> {
  // Clone shallowly so Ajv useDefaults doesn't mutate caller-held frozen objects
  const candidate =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : raw;

  const ok = compiledExamSetValidator(candidate);
  if (!ok) {
    return {
      valid: false,
      errors: formatAjvErrors(compiledExamSetValidator.errors),
    };
  }
  return {
    valid: true,
    data: candidate as ExamSetCreatePayload,
  };
}

export interface SchemaMiddlewareOptions {
  auditService?: AuditService;
  resource?: string;
}

export function validateJsonSchemaBody<T>(
  schema: Record<string, unknown>,
  options: SchemaMiddlewareOptions = {}
): RequestHandler {
  const validator = ajv.compile<T>(schema);

  return async (req: Request, res: Response, next: NextFunction) => {
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? { ...(req.body as Record<string, unknown>) }
        : req.body;

    if (!validator(body)) {
      const formatted = formatAjvErrors(validator.errors);
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent;
      const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

      await options.auditService?.recordSafe({
        actorType: 'student',
        userId: student?.userId ?? null,
        action: 'security.schema_validation_failed',
        resource: options.resource ?? 'exam_set',
        outcome: 'DENY',
        requestId: reqId,
        meta: { errorCount: formatted.length, keywords: formatted.map((e) => e.keyword) },
      });

      return res.status(400).json({
        data: null,
        error: {
          message: 'Dữ liệu đầu vào không hợp lệ theo JSON Schema',
          code: 'SCHEMA_VALIDATION_ERROR',
          status: 400,
          details: formatted,
        },
      });
    }

    req.body = body;
    return next();
  };
}
