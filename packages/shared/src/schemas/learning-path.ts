import { z } from 'zod';

export const MilestoneStatusSchema = z.enum(['LOCKED', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED']);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  LOCKED: 'Chưa mở khoá',
  IN_PROGRESS: 'Đang thực hiện',
  NEEDS_REVIEW: 'Cần bổ trợ & ôn tập',
  COMPLETED: 'Đã hoàn thành',
};

export const GenerateLearningPathRequestSchema = z.object({
  targetGoal: z.string().min(5, 'Mục tiêu học tập tối thiểu 5 ký tự').max(300, 'Mục tiêu tối đa 300 ký tự'),
  currentLevel: z.enum(['CO_BAN', 'TRUNG_BINH', 'NANG_CAO']).default('TRUNG_BINH'),
  hoursPerWeek: z.number().int().min(2, 'Tối thiểu 2 giờ/tuần').max(40, 'Tối đa 40 giờ/tuần').default(6),
});
export type GenerateLearningPathRequest = z.infer<typeof GenerateLearningPathRequestSchema>;

export const MilestoneQuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  code: z.string().optional(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  conceptTag: z.string().optional(),
});
export type MilestoneQuizQuestion = z.infer<typeof MilestoneQuizQuestionSchema>;

export const RemedialLessonItemSchema = z.object({
  lessonId: z.string(),
  title: z.string(),
  reason: z.string(),
});
export type RemedialLessonItem = z.infer<typeof RemedialLessonItemSchema>;

export const RemedialQuestionItemSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  code: z.string().optional(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  concept: z.string(),
});
export type RemedialQuestionItem = z.infer<typeof RemedialQuestionItemSchema>;

export const MilestoneRemediationSchema = z.object({
  id: z.string(),
  milestoneId: z.string(),
  weaknessAnalysis: z.string(),
  recommendedLessons: z.array(RemedialLessonItemSchema),
  remedialQuestions: z.array(RemedialQuestionItemSchema),
  resolved: z.boolean().default(false),
  createdAt: z.string().datetime().or(z.string()),
});
export type MilestoneRemediation = z.infer<typeof MilestoneRemediationSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  learningPathId: z.string(),
  orderIndex: z.number().int(),
  title: z.string(),
  description: z.string(),
  estimatedHours: z.number(),
  passingScore: z.number().default(70),
  status: MilestoneStatusSchema,
  lessonIds: z.array(z.string()),
  quizQuestions: z.array(MilestoneQuizQuestionSchema),
  remediation: MilestoneRemediationSchema.nullable().optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const LearningPathSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseTitle: z.string().optional(),
  userId: z.string(),
  targetGoal: z.string(),
  currentLevel: z.string(),
  hoursPerWeek: z.number(),
  aiSummary: z.string(),
  modelName: z.string().default('gemini-4-hydrogen-medium'),
  progressPercent: z.number().min(0).max(100).default(0),
  milestones: z.array(MilestoneSchema),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});
export type LearningPath = z.infer<typeof LearningPathSchema>;

export const EvaluateMilestoneRequestSchema = z.object({
  answers: z.record(z.string(), z.number()), // questionId -> selectedIndex
});
export type EvaluateMilestoneRequest = z.infer<typeof EvaluateMilestoneRequestSchema>;

export const EvaluateMilestoneResponseSchema = z.object({
  milestoneId: z.string(),
  score: z.number(),
  passingScore: z.number(),
  passed: z.boolean(),
  status: MilestoneStatusSchema,
  feedback: z.string(),
  nextMilestoneId: z.string().nullable().optional(),
  remediation: MilestoneRemediationSchema.nullable().optional(),
});
export type EvaluateMilestoneResponse = z.infer<typeof EvaluateMilestoneResponseSchema>;
