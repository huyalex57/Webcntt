import { z } from 'zod';

export const LanguageSchema = z.enum(['cpp', 'python', 'java', 'c', 'go']);
export type CodeLanguage = z.infer<typeof LanguageSchema>;

export const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  cpp: 'C++ (GCC 13.2)',
  python: 'Python 3.12',
  java: 'Java 21',
  c: 'C (GCC 13.2)',
  go: 'Go 1.22',
};

export const LANGUAGE_EXT: Record<CodeLanguage, string> = {
  cpp: 'cpp',
  python: 'py',
  java: 'java',
  c: 'c',
  go: 'go',
};

export const LanguageInfoSchema = z.object({
  id: z.string(),
  slug: LanguageSchema,
  name: z.string(),
  judge0Id: z.number().int(),
  monacoLanguage: z.string(),
  extension: z.string(),
  starterCode: z.string(),
});
export type LanguageInfo = z.infer<typeof LanguageInfoSchema>;

export const RunStatusSchema = z.enum(['AC', 'WA', 'TLE', 'MLE', 'CE', 'RE']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const CodeQuotaInfoSchema = z.object({
  used: z.number().int(),
  limit: z.number().int(),
  remaining: z.number().int(),
  plan: z.enum(['FREE', 'PREMIUM']).optional(),
  limits: z
    .object({
      cpuTimeLimitS: z.number(),
      wallTimeLimitS: z.number(),
      memoryLimitKb: z.number(),
      memoryLimitMb: z.number(),
      maxStdinBytes: z.number(),
      snippetLimit: z.number(),
    })
    .optional(),
});
export type CodeQuotaInfo = z.infer<typeof CodeQuotaInfoSchema>;

export const RunResultSchema = z.object({
  status: RunStatusSchema,
  stdout: z.string(),
  stderr: z.string(),
  compileOutput: z.string().optional(),
  compile_output: z.string().optional(),
  exitCode: z.number(),
  exit_code: z.number().optional(),
  timeMs: z.number(),
  time_ms: z.number().optional(),
  memoryKb: z.number().optional(),
  memory_kb: z.number().optional(),
  memoryMb: z.number(),
  quota: CodeQuotaInfoSchema.optional(),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export const RunCodeBodySchema = z
  .object({
    code: z.string().min(1, 'Mã nguồn không được để trống').max(100_000, 'Mã nguồn quá dài'),
    language: LanguageSchema.optional(),
    languageId: z.string().optional(),
    stdin: z.string().default(''),
  })
  .refine((d) => Boolean(d.language || d.languageId), {
    message: 'Vui lòng chọn ngôn ngữ lập trình',
    path: ['language'],
  });
export type RunCodeBody = z.infer<typeof RunCodeBodySchema>;

export const CodeSnippetSchema = z.object({
  id: z.string(),
  title: z.string(),
  language: LanguageSchema,
  languageId: z.string().optional(),
  code: z.string(),
  userId: z.string().optional(),
  isPublic: z.boolean().optional(),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()).optional(),
  lastRunStatus: RunStatusSchema.optional().nullable(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const CreateSnippetBodySchema = z
  .object({
    title: z.string().trim().min(1, 'Tên snippet không được để trống').max(120),
    language: LanguageSchema.optional(),
    languageId: z.string().optional(),
    code: z.string().min(1, 'Mã nguồn không được để trống').max(100_000),
    isPublic: z.boolean().default(false),
    lastRunStatus: RunStatusSchema.optional().nullable(),
  })
  .refine((d) => Boolean(d.language || d.languageId), {
    message: 'Vui lòng chọn ngôn ngữ lập trình',
    path: ['language'],
  });
export type CreateSnippetBody = z.infer<typeof CreateSnippetBodySchema>;
