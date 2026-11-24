import { z } from 'zod';
import { TopicSchema } from './resources';

export const QuestionTypeSchema = z.enum(['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'READ_CODE', 'DEBUG']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng / Sai',
  FILL_BLANK: 'Điền khuyết',
  READ_CODE: 'Đọc code đoán output',
  DEBUG: 'Tìm lỗi (debug)',
};

export const LevelSchema = z.enum(['CO_BAN', 'TRUNG_BINH', 'NANG_CAO']);
export type Level = z.infer<typeof LevelSchema>;

export const LEVEL_LABELS: Record<Level, string> = {
  CO_BAN: 'Cơ bản',
  TRUNG_BINH: 'Trung bình — Khá',
  NANG_CAO: 'Nâng cao',
};

export const QuestionSchema = z.object({
  id: z.string(),
  topic: TopicSchema,
  level: LevelSchema,
  type: QuestionTypeSchema,
  prompt: z.string(),
  code: z.string().optional(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string(),
  difficulty: z.enum(['Dễ', 'Trung bình', 'Khó']),
});
export type Question = z.infer<typeof QuestionSchema>;

export const PracticeSetRequestSchema = z.object({
  topic: TopicSchema,
  level: LevelSchema,
  count: z.number().int().min(1).max(20),
  type: QuestionTypeSchema,
});
export type PracticeSetRequest = z.infer<typeof PracticeSetRequestSchema>;

export const PracticeSetSchema = z.object({
  id: z.string(),
  topic: TopicSchema,
  level: LevelSchema,
  questions: z.array(QuestionSchema),
  createdAt: z.string().datetime().or(z.string()),
});
export type PracticeSet = z.infer<typeof PracticeSetSchema>;

export const SkillProfileSchema = z.object({
  topic: TopicSchema,
  accuracy: z.number(),
  answered: z.number(),
  weak: z.boolean(),
});
export type SkillProfile = z.infer<typeof SkillProfileSchema>;

// ==========================================
// Phase 0 - Core Question Bank & Practice Attempts
// ==========================================

export const QuestionDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export type QuestionDifficulty = z.infer<typeof QuestionDifficultySchema>;

export const QUESTION_DIFFICULTY_LABELS: Record<QuestionDifficulty, 'Dễ' | 'Trung bình' | 'Khó'> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

export const QuestionStatusSchema = z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

/** Câu hỏi trả về trước khi nộp bài — tuyệt đối không lộ correctIndex và explanation. */
export const PracticeQuestionItemSchema = z.object({
  id: z.string(),
  topic: TopicSchema,
  level: LevelSchema,
  type: QuestionTypeSchema,
  difficulty: QuestionDifficultySchema,
  difficultyLabel: z.enum(['Dễ', 'Trung bình', 'Khó']),
  prompt: z.string(),
  code: z.string().nullable().optional(),
  options: z.array(z.string()).min(2),
  tags: z.array(z.string()),
  estimatedTimeSec: z.number().int().positive(),
});
export type PracticeQuestionItem = z.infer<typeof PracticeQuestionItemSchema>;

export const SubmitPracticeAnswerItemSchema = z.object({
  questionId: z.string().min(1, 'Thiếu questionId'),
  selectedIndex: z.number().int().min(0).nullable().optional(),
  timeSpentMs: z.number().int().min(0).max(3_600_000).default(0),
});
export type SubmitPracticeAnswerItem = z.infer<typeof SubmitPracticeAnswerItemSchema>;

export const SubmitPracticeAttemptRequestSchema = z
  .object({
    practiceSetId: z.string().min(1).max(128).optional(),
    topic: TopicSchema.optional(),
    startedAt: z.string().datetime().optional(),
    durationMs: z.number().int().min(0).max(14_400_000).optional(),
    answers: z
      .array(SubmitPracticeAnswerItemSchema)
      .min(1, 'Cần nộp ít nhất 1 câu trả lời')
      .max(50, 'Tối đa 50 câu mỗi lượt nộp'),
  })
  .refine(
    (data) => {
      const ids = data.answers.map((a) => a.questionId);
      return new Set(ids).size === ids.length;
    },
    {
      message: 'Danh sách answers không được chứa questionId trùng lặp',
      path: ['answers'],
    }
  );
export type SubmitPracticeAttemptRequest = z.infer<typeof SubmitPracticeAttemptRequestSchema>;

export const PracticeAnswerGradedSchema = z.object({
  questionId: z.string(),
  topic: TopicSchema,
  difficulty: QuestionDifficultySchema,
  prompt: z.string(),
  code: z.string().nullable().optional(),
  options: z.array(z.string()),
  selectedIndex: z.number().int().nullable(),
  correctIndex: z.number().int(),
  isCorrect: z.boolean(),
  explanation: z.string(),
  timeSpentMs: z.number().int(),
  answeredAt: z.string(),
});
export type PracticeAnswerGraded = z.infer<typeof PracticeAnswerGradedSchema>;

export const PracticeAttemptSummarySchema = z.object({
  id: z.string(),
  practiceSetId: z.string().nullable(),
  topic: TopicSchema.nullable(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  score: z.number().int(),
  durationMs: z.number().int(),
  startedAt: z.string().nullable(),
  submittedAt: z.string(),
});
export type PracticeAttemptSummary = z.infer<typeof PracticeAttemptSummarySchema>;

export const SubmitPracticeAttemptResponseSchema = z.object({
  attempt: PracticeAttemptSummarySchema,
  answers: z.array(PracticeAnswerGradedSchema),
  updatedSkillProfiles: z.array(SkillProfileSchema),
});
export type SubmitPracticeAttemptResponse = z.infer<typeof SubmitPracticeAttemptResponseSchema>;
