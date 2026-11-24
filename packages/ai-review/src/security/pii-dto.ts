import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PlanCode, TopicCode } from '../contracts/events.js';
import type {
  AnonymousStudentSummary,
  AttemptAnswerRecord,
  AuthenticatedStudentRequest,
  StudentPlanSubscription,
} from '../contracts/ports.js';
import type { AuditService } from './audit.service.js';

export interface MinimizedStudentProfileDto {
  alias: 'Học viên';
  role: 'STUDENT';
  plan: PlanCode;
  self_level: string | null;
  enrolled_courses: Array<{ slug: string; progress: number }>;
}

export interface MinimizedAttemptTopicSummary {
  topic: TopicCode;
  answered: number;
  accuracy: number;
  avg_time_s: number;
}

export interface MinimizedAttemptItemDto {
  question_id: string;
  topic: TopicCode;
  difficulty: 'easy' | 'medium' | 'hard';
  correct: boolean;
  time_spent_s: number;
  answered_on: string; // YYYY-MM-DD (giảm chi tiết thời gian thừa)
}

export interface MinimizedAttemptHistoryDto {
  summary: MinimizedAttemptTopicSummary[];
  items: MinimizedAttemptItemDto[];
}

const DIFFICULTY_MAP: Record<AttemptAnswerRecord['difficulty'], 'easy' | 'medium' | 'hard'> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

/**
 * Strictly constructs PII-minimized learner profile (no email, studentId, real name, university).
 */
export function toMinimizedStudentProfileDto(
  summary: AnonymousStudentSummary,
  subscription: StudentPlanSubscription
): MinimizedStudentProfileDto {
  return {
    alias: 'Học viên',
    role: 'STUDENT',
    plan: subscription.planCode,
    self_level: summary.selfLevel ?? null,
    enrolled_courses: summary.enrolledCourses.map((c) => ({
      slug: c.slug,
      progress: c.progress,
    })),
  };
}

/**
 * Strictly constructs PII-minimized attempt history (no prompt text, no chosen option text, no user PII).
 */
export function toMinimizedAttemptHistoryDto(
  records: AttemptAnswerRecord[]
): MinimizedAttemptHistoryDto {
  const byTopic = new Map<
    TopicCode,
    { answered: number; correct: number; totalTimeMs: number }
  >();

  const items: MinimizedAttemptItemDto[] = records.map((r) => {
    const stat = byTopic.get(r.topic) ?? { answered: 0, correct: 0, totalTimeMs: 0 };
    stat.answered += 1;
    if (r.isCorrect) stat.correct += 1;
    stat.totalTimeMs += r.timeSpentMs;
    byTopic.set(r.topic, stat);

    return {
      question_id: r.questionId,
      topic: r.topic,
      difficulty: DIFFICULTY_MAP[r.difficulty],
      correct: r.isCorrect,
      time_spent_s: Math.round(r.timeSpentMs / 1000),
      answered_on: r.answeredAt.toISOString().slice(0, 10),
    };
  });

  const summary: MinimizedAttemptTopicSummary[] = [...byTopic.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, stat]) => ({
      topic,
      answered: stat.answered,
      accuracy: Number((stat.correct / stat.answered).toFixed(2)),
      avg_time_s: Math.round(stat.totalTimeMs / stat.answered / 1000),
    }));

  return { summary, items };
}

const FORBIDDEN_QUERY_IDENTITY_KEYS = ['student_id', 'studentid', 'user_id', 'userid'];

/**
 * Blocks any attempt by client or payload to override the session's `student_id`.
 * - Query params (`?student_id=...`, `?userId=...`) are ALWAYS rejected (403 + DENY audit).
 * - Body `student_id` (if provided) MUST strictly equal `req.aiReviewStudent.userId` (mismatch -> 403 + DENY audit).
 */
export function rejectStudentOverride(
  auditService?: AuditService,
  resource: string = 'student_data'
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const student = (req as AuthenticatedStudentRequest).aiReviewStudent;
    if (!student?.userId) {
      return res.status(401).json({
        data: null,
        error: { message: 'Yêu cầu đăng nhập', code: 'UNAUTHORIZED', status: 401 },
      });
    }

    const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

    for (const qKey of Object.keys(req.query ?? {})) {
      if (FORBIDDEN_QUERY_IDENTITY_KEYS.includes(qKey.toLowerCase())) {
        await auditService?.recordSafe({
          actorType: 'student',
          userId: student.userId,
          action: 'security.student_override_blocked',
          resource,
          outcome: 'DENY',
          requestId: reqId,
          meta: { channel: 'query', param: qKey },
        });
        return res.status(403).json({
          data: null,
          error: {
            message: 'Không được phép truyền student_id tuỳ ý — dữ liệu luôn giới hạn theo phiên hiện tại',
            code: 'FORBIDDEN_STUDENT_OVERRIDE',
            status: 403,
          },
        });
      }
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (body && typeof body === 'object') {
      const bodyStudentId =
        typeof body.student_id === 'string'
          ? body.student_id
          : typeof body.studentId === 'string'
            ? body.studentId
            : typeof body.userId === 'string'
              ? body.userId
              : undefined;

      if (bodyStudentId !== undefined && bodyStudentId !== student.userId) {
        await auditService?.recordSafe({
          actorType: 'student',
          userId: student.userId,
          action: 'security.student_override_blocked',
          resource,
          outcome: 'DENY',
          requestId: reqId,
          meta: { channel: 'body', mismatched: true },
        });
        return res.status(403).json({
          data: null,
          error: {
            message: 'student_id trong yêu cầu không khớp phiên đăng nhập hiện tại',
            code: 'FORBIDDEN_STUDENT_OVERRIDE',
            status: 403,
          },
        });
      }
    }

    return next();
  };
}
