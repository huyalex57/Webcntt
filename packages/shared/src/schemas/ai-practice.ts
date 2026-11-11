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
