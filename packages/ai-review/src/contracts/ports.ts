import type { Request, RequestHandler } from 'express';
import type { EventBusPort, PlanCode, TopicCode } from './events.js';

/**
 * Major contract version between host app and @devstudy/ai-review.
 * Host must declare the version it implements; major mismatch causes the module to refuse startup.
 */
export const CONTRACT_VERSION = 1 as const;

export class ContractVersionMismatchError extends Error {
  readonly code = 'CONTRACT_VERSION_MISMATCH';
  readonly expectedMajor: number;
  readonly receivedVersion: number;

  constructor(receivedVersion: number, expectedMajor: number = CONTRACT_VERSION) {
    super(
      `Contract version mismatch for @devstudy/ai-review: expected major ${expectedMajor}, host provided ${receivedVersion}`
    );
    this.name = 'ContractVersionMismatchError';
    this.expectedMajor = expectedMajor;
    this.receivedVersion = receivedVersion;
  }
}

export interface AuthenticatedStudent {
  userId: string;
  role: 'STUDENT';
}

export interface AuthenticatedStudentRequest extends Request {
  aiReviewStudent?: AuthenticatedStudent;
}

/**
 * Host authenticates the request and enforces STUDENT-only role.
 * Must attach `req.aiReviewStudent = { userId, role: 'STUDENT' }` before calling `next()`.
 */
export interface AuthPort {
  requireStudent(): RequestHandler;
}

/**
 * Strictly anonymous learner summary — NO email, NO studentId, NO displayName, NO university.
 */
export interface AnonymousStudentSummary {
  selfLevel?: string;
  enrolledCourses: Array<{
    slug: string;
    progress: number;
  }>;
}

export interface StudentDirectoryPort {
  getStudentSummary(userId: string): Promise<AnonymousStudentSummary>;
}

/**
 * Real subscription record from core DB (not JWT claim) so monthly quota cycles anchor on `startedAt`.
 */
export interface StudentPlanSubscription {
  planCode: PlanCode;
  startedAt: Date;
  expiresAt: Date | null;
}

export interface PlanResolverPort {
  getPlanSubscription(userId: string): Promise<StudentPlanSubscription>;
}

export type QuestionDifficultyCode = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionLevelCode = 'CO_BAN' | 'TRUNG_BINH' | 'NANG_CAO';
export type QuestionTypeCode = 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'READ_CODE' | 'DEBUG';

export interface AttemptAnswerRecord {
  questionId: string;
  topic: TopicCode;
  difficulty: QuestionDifficultyCode;
  isCorrect: boolean;
  timeSpentMs: number;
  answeredAt: Date;
}

export interface AttemptHistoryFilter {
  since?: Date;
  topic?: TopicCode;
  limit?: number;
}

export interface AttemptHistoryPort {
  listAnswers(userId: string, filter?: AttemptHistoryFilter): Promise<AttemptAnswerRecord[]>;
}

/**
 * Candidate question from the APPROVED pool — NEVER exposes `correctIndex` or `explanation`.
 */
export interface QuestionCandidate {
  id: string;
  topic: TopicCode;
  level: QuestionLevelCode;
  type: QuestionTypeCode;
  difficulty: QuestionDifficultyCode;
  tags: string[];
  estimatedTimeSec: number;
}

/**
 * Playable question hydrated for student exam-taking view — NEVER exposes `correctIndex` or `explanation`.
 */
export interface PlayableQuestion extends QuestionCandidate {
  prompt: string;
  code: string | null;
  options: string[];
}

export interface QuestionPoolFilter {
  topics?: TopicCode[];
  difficulties?: QuestionDifficultyCode[];
  tags?: string[];
  excludeIds?: string[];
  limit?: number;
}

export interface QuestionPoolPort {
  findCandidates(filter?: QuestionPoolFilter): Promise<QuestionCandidate[]>;
  getByIds(ids: string[]): Promise<QuestionCandidate[]>;
  getPlayableByIds?(ids: string[]): Promise<PlayableQuestion[]>;
}

export interface LoggerPort {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  child?(bindings: Record<string, unknown>): LoggerPort;
}

export interface AiReviewHostPorts {
  contractVersion: number;
  auth: AuthPort;
  studentDirectory: StudentDirectoryPort;
  planResolver: PlanResolverPort;
  attemptHistory: AttemptHistoryPort;
  questionPool: QuestionPoolPort;
  eventBus: EventBusPort;
  logger?: LoggerPort;
}
