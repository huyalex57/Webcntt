// @devstudy/shared — types + Zod schemas dùng chung FE/BE (workflow §5.1, §6).
// Ghi chú: schema ở đây là bản FE; khi làm backend thật, import lại package này
// trong Express để validate cùng một nguồn sự thật (single source of truth).
import { z } from 'zod';

export const RoleSchema = z.enum(['STUDENT', 'LECTURER', 'MODERATOR', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const PlanTierSchema = z.enum(['FREE', 'PREMIUM']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

/** GUEST không phải role DB — chỉ là trạng thái chưa đăng nhập. */
export type GuestOrRole = 'GUEST' | Role;

export const ResourceStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'REJECTED']);
export type ResourceStatus = z.infer<typeof ResourceStatusSchema>;

export const ResourceTypeSchema = z.enum(['SLIDE', 'TEXTBOOK', 'EXAM', 'EXERCISE', 'CHEATSHEET', 'VIDEO', 'SOURCE']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const TopicSchema = z.enum(['CTDL', 'OOP', 'CSDL', 'MANG', 'HDH', 'AI_DS', 'WEB_CLOUD']);
export type Topic = z.infer<typeof TopicSchema>;

export const TOPIC_LABELS: Record<Topic, string> = {
  CTDL: 'Cấu trúc dữ liệu & Giải thuật',
  OOP: 'Lập trình hướng đối tượng',
  CSDL: 'Cơ sở dữ liệu & SQL',
  MANG: 'Mạng máy tính & An toàn thông tin',
  HDH: 'Hệ điều hành',
  AI_DS: 'Trí tuệ nhân tạo & Data Science',
  WEB_CLOUD: 'Công nghệ Web & Cloud',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  SLIDE: 'Slide bài giảng',
  TEXTBOOK: 'Giáo trình & Sách',
  EXAM: 'Đề thi & Đáp án',
  EXERCISE: 'Bài tập',
  CHEATSHEET: 'Cheat-sheet',
  VIDEO: 'Video',
  SOURCE: 'Đồ án & Source code',
};

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  plan: PlanTierSchema,
  studentId: z.string().optional(),
  university: z.string().optional(),
  emailVerified: z.boolean().default(true),
});
export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  displayName: z.string().min(2, 'Nhập họ tên đầy đủ'),
  email: z.string().email('Email không hợp lệ'),
  studentId: z.string().min(4, 'Nhập mã số sinh viên'),
  university: z.string().min(2, 'Chọn trường'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  confirmPassword: z.string(),
  agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý điều khoản học vụ'),
}).refine((d) => d.password === d.confirmPassword, { message: 'Mật khẩu xác nhận không khớp', path: ['confirmPassword'] });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topic: TopicSchema,
  type: ResourceTypeSchema,
  language: z.string(),
  author: z.string(),
  source: z.enum(['OFFICIAL', 'COMMUNITY', 'LECTURER']),
  status: ResourceStatusSchema,
  downloads: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  fileSize: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const LessonSchema = z.object({ id: z.string(), title: z.string(), durationMin: z.number(), free: z.boolean().default(false), done: z.boolean().default(false) });
export type Lesson = z.infer<typeof LessonSchema>;
export const SectionSchema = z.object({ id: z.string(), title: z.string(), lessons: z.array(LessonSchema) });
export type Section = z.infer<typeof SectionSchema>;

export const CourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  instructor: z.string(),
  instructorRole: z.string(),
  category: z.string(),
  price: z.number(),
  originalPrice: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  students: z.number(),
  hours: z.number(),
  lessonsCount: z.number(),
  labs: z.number(),
  level: z.enum(['Cơ bản', 'Trung cấp', 'Nâng cao']),
  tags: z.array(z.string()),
  sections: z.array(SectionSchema),
  certificate: z.boolean().default(true),
});
export type Course = z.infer<typeof CourseSchema>;

export const EnrollmentSchema = z.object({
  courseId: z.string(), progress: z.number().min(0).max(100), completedLessons: z.number(), totalLessons: z.number(), certificateIssued: z.boolean().default(false),
});
export type Enrollment = z.infer<typeof EnrollmentSchema>;

export const QuestionTypeSchema = z.enum(['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'READ_CODE', 'DEBUG']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'Trắc nghiệm', TRUE_FALSE: 'Đúng / Sai', FILL_BLANK: 'Điền khuyết', READ_CODE: 'Đọc code đoán output', DEBUG: 'Tìm lỗi (debug)',
};
export const LevelSchema = z.enum(['CO_BAN', 'TRUNG_BINH', 'NANG_CAO']);
export type Level = z.infer<typeof LevelSchema>;
export const LEVEL_LABELS: Record<Level, string> = { CO_BAN: 'Cơ bản', TRUNG_BINH: 'Trung bình — Khá', NANG_CAO: 'Nâng cao' };

export const QuestionSchema = z.object({
  id: z.string(), topic: TopicSchema, level: LevelSchema, type: QuestionTypeSchema,
  prompt: z.string(), code: z.string().optional(), options: z.array(z.string()),
  correctIndex: z.number(), explanation: z.string(), difficulty: z.enum(['Dễ', 'Trung bình', 'Khó']),
});
export type Question = z.infer<typeof QuestionSchema>;

export const PracticeSetRequestSchema = z.object({
  topic: TopicSchema, level: LevelSchema, count: z.number().int().min(1).max(20), type: QuestionTypeSchema,
});
export type PracticeSetRequest = z.infer<typeof PracticeSetRequestSchema>;

export const PracticeSetSchema = z.object({ id: z.string(), topic: TopicSchema, level: LevelSchema, questions: z.array(QuestionSchema), createdAt: z.string() });
export type PracticeSet = z.infer<typeof PracticeSetSchema>;

export const SkillProfileSchema = z.object({ topic: TopicSchema, accuracy: z.number(), answered: z.number(), weak: z.boolean() });
export type SkillProfile = z.infer<typeof SkillProfileSchema>;

export const LanguageSchema = z.enum(['cpp', 'python', 'java', 'c', 'go']);
export type CodeLanguage = z.infer<typeof LanguageSchema>;
export const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  cpp: 'C++ (GCC 13.2)', python: 'Python 3.12', java: 'Java 21', c: 'C (GCC 13.2)', go: 'Go 1.22',
};
export const LANGUAGE_EXT: Record<CodeLanguage, string> = { cpp: 'cpp', python: 'py', java: 'java', c: 'c', go: 'go' };

export const RunStatusSchema = z.enum(['AC', 'WA', 'TLE', 'CE', 'RE']);
export type RunStatus = z.infer<typeof RunStatusSchema>;
export const RunResultSchema = z.object({
  status: RunStatusSchema, stdout: z.string(), stderr: z.string(), exitCode: z.number(), timeMs: z.number(), memoryMb: z.number(),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export const CodeSnippetSchema = z.object({
  id: z.string(), title: z.string(), language: LanguageSchema, code: z.string(), createdAt: z.string(), lastRunStatus: RunStatusSchema.optional(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const TestCaseSchema = z.object({ id: z.string(), input: z.string(), expectedOutput: z.string(), hidden: z.boolean(), points: z.number() });
export type TestCase = z.infer<typeof TestCaseSchema>;
export const ProblemSchema = z.object({
  id: z.string(), title: z.string(), statement: z.string(), points: z.number(), timeLimitMs: z.number(), memoryLimitMb: z.number(), testCases: z.array(TestCaseSchema),
});
export type Problem = z.infer<typeof ProblemSchema>;
export const ExamSchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), creator: z.string(),
  startsAt: z.string(), endsAt: z.string(), durationMin: z.number(),
  languages: z.array(LanguageSchema), status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']),
  participants: z.number(), problems: z.array(ProblemSchema),
});
export type Exam = z.infer<typeof ExamSchema>;

export const CreateExamSchema = z.object({
  title: z.string().min(5, 'Tên kỳ thi tối thiểu 5 ký tự'),
  description: z.string().min(10, 'Nhập mô tả đề bài'),
  durationMin: z.number().int().min(15).max(480),
  languages: z.array(LanguageSchema).min(1, 'Chọn ít nhất 1 ngôn ngữ'),
});
export type CreateExamInput = z.infer<typeof CreateExamSchema>;

export const ReportSchema = z.object({
  resourceId: z.string(), reason: z.enum(['BAN_QUYEN', 'SAI_LECH', 'DOC_HAI', 'KHONG_PHU_HOP']), detail: z.string().min(10, 'Mô tả tối thiểu 10 ký tự'),
});
export type ReportInput = z.infer<typeof ReportSchema>;

export const ApiErrorSchema = z.object({ message: z.string(), code: z.string().optional(), status: z.number().optional() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Gói Free: 10 câu AI/ngày; Premium: không giới hạn (workflow §5.4). */
export const FREE_AI_QUOTA_PER_DAY = 10;
/** Playground Free: 30 lần chạy/ngày, 3 snippet; Premium: 200 lần, 50 snippet. */
export const FREE_RUN_QUOTA_PER_DAY = 30;
export const FREE_SNIPPET_LIMIT = 3;
export const PREMIUM_SNIPPET_LIMIT = 50;
