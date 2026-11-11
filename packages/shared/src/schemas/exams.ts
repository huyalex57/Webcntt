import { z } from 'zod';
import { LanguageSchema } from './playground';

export const TestCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
  points: z.number(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const ProblemSchema = z.object({
  id: z.string(),
  title: z.string(),
  statement: z.string(),
  points: z.number(),
  timeLimitMs: z.number(),
  memoryLimitMb: z.number(),
  testCases: z.array(TestCaseSchema),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const ExamSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  creator: z.string(),
  startsAt: z.string().datetime().or(z.string()),
  endsAt: z.string().datetime().or(z.string()),
  durationMin: z.number(),
  languages: z.array(LanguageSchema),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']),
  participants: z.number(),
  problems: z.array(ProblemSchema),
});
export type Exam = z.infer<typeof ExamSchema>;

export const CreateExamSchema = z.object({
  title: z.string().min(5, 'Tên kỳ thi tối thiểu 5 ký tự'),
  description: z.string().min(10, 'Nhập mô tả đề bài'),
  durationMin: z.number().int().min(15).max(480),
  languages: z.array(LanguageSchema).min(1, 'Chọn ít nhất 1 ngôn ngữ'),
});
export type CreateExamInput = z.infer<typeof CreateExamSchema>;
