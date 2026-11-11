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

export const RunStatusSchema = z.enum(['AC', 'WA', 'TLE', 'CE', 'RE']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunResultSchema = z.object({
  status: RunStatusSchema,
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  timeMs: z.number(),
  memoryMb: z.number(),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export const CodeSnippetSchema = z.object({
  id: z.string(),
  title: z.string(),
  language: LanguageSchema,
  code: z.string(),
  createdAt: z.string().datetime().or(z.string()),
  lastRunStatus: RunStatusSchema.optional(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;
