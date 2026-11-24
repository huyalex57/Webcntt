import { PlanTier, RunStatus } from '@prisma/client';
import {
  FREE_CPU_LIMIT_S,
  FREE_MEMORY_LIMIT_KB,
  FREE_SNIPPET_LIMIT,
  FREE_STDIN_MAX_BYTES,
  FREE_WALL_TIME_LIMIT_S,
  PREMIUM_CPU_LIMIT_S,
  PREMIUM_MEMORY_LIMIT_KB,
  PREMIUM_SNIPPET_LIMIT,
  PREMIUM_STDIN_MAX_BYTES,
  PREMIUM_WALL_TIME_LIMIT_S,
  type CodeLanguage,
  type CodeSnippet,
  type CreateSnippetBody,
  type RunCodeBody,
} from '@devstudy/shared';
import { prisma } from '../../config/prisma.js';
import { getQuotaUsage } from '../../middlewares/checkQuota.js';
import { executeInJudge0 } from './judge0.service.js';

export function getPlanSandboxLimits(plan: PlanTier) {
  if (plan === PlanTier.PREMIUM) {
    return {
      cpuTimeLimitS: PREMIUM_CPU_LIMIT_S,
      wallTimeLimitS: PREMIUM_WALL_TIME_LIMIT_S,
      memoryLimitKb: PREMIUM_MEMORY_LIMIT_KB,
      memoryLimitMb: Math.round(PREMIUM_MEMORY_LIMIT_KB / 1024),
      maxStdinBytes: PREMIUM_STDIN_MAX_BYTES,
      snippetLimit: PREMIUM_SNIPPET_LIMIT,
    };
  }

  return {
    cpuTimeLimitS: FREE_CPU_LIMIT_S,
    wallTimeLimitS: FREE_WALL_TIME_LIMIT_S,
    memoryLimitKb: FREE_MEMORY_LIMIT_KB,
    memoryLimitMb: Math.round(FREE_MEMORY_LIMIT_KB / 1024),
    maxStdinBytes: FREE_STDIN_MAX_BYTES,
    snippetLimit: FREE_SNIPPET_LIMIT,
  };
}

export async function listLanguages() {
  const languages = await prisma.language.findMany({
    where: { isActive: true },
    orderBy: { slug: 'asc' },
  });

  return languages.map((l) => ({
    id: l.id,
    slug: l.slug as CodeLanguage,
    name: l.name,
    judge0Id: l.judge0Id,
    monacoLanguage: l.monacoLanguage,
    extension: l.extension,
    starterCode: l.starterCode,
  }));
}

export async function getUserCodeQuota(userId: string, plan: PlanTier) {
  const usage = await getQuotaUsage('code_run', userId, plan);
  const limits = getPlanSandboxLimits(plan);

  return {
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    plan,
    limits,
  };
}

async function resolveLanguage(languageSlug?: string, languageId?: string) {
  const lang = await prisma.language.findFirst({
    where: {
      isActive: true,
      ...(languageId ? { id: languageId } : { slug: languageSlug }),
    },
  });

  if (!lang) {
    throw {
      status: 400,
      code: 'UNSUPPORTED_LANGUAGE',
      message: `Ngôn ngữ lập trình "${languageSlug || languageId}" không được hỗ trợ`,
    };
  }
  return lang;
}

export async function runCode(
  userId: string,
  plan: PlanTier,
  body: RunCodeBody,
  quota?: { used: number; limit: number; remaining: number }
) {
  const limits = getPlanSandboxLimits(plan);
  const stdinBytes = Buffer.byteLength(body.stdin ?? '', 'utf8');

  if (stdinBytes > limits.maxStdinBytes) {
    throw {
      status: 400,
      code: 'STDIN_TOO_LARGE',
      message: `Kích thước dữ liệu đầu vào (stdin) vượt quá giới hạn ${Math.round(
        limits.maxStdinBytes / 1024
      )}KB của gói ${plan}. Nâng cấp PREMIUM để nhập stdin lên tới 1MB.`,
    };
  }

  const language = await resolveLanguage(body.language, body.languageId);

  const result = await executeInJudge0({
    sourceCode: body.code,
    languageId: language.judge0Id,
    stdin: body.stdin ?? '',
    cpuTimeLimitS: limits.cpuTimeLimitS,
    wallTimeLimitS: limits.wallTimeLimitS,
    memoryLimitKb: limits.memoryLimitKb,
  });

  await prisma.runLog.create({
    data: {
      userId,
      languageId: language.id,
      status: result.status,
      timeMs: result.timeMs,
      memoryKb: result.memoryKb,
      exitCode: result.exitCode,
    },
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    compileOutput: result.compileOutput,
    compile_output: result.compileOutput,
    exitCode: result.exitCode,
    exit_code: result.exitCode,
    timeMs: result.timeMs,
    time_ms: result.timeMs,
    memoryKb: result.memoryKb,
    memory_kb: result.memoryKb,
    memoryMb: result.memoryMb,
    quota: quota
      ? {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          plan,
        }
      : undefined,
  };
}

function mapSnippet(s: {
  id: string;
  title: string;
  code: string;
  userId: string;
  languageId: string;
  isPublic: boolean;
  lastRunStatus: RunStatus | null;
  createdAt: Date;
  updatedAt: Date;
  language: { slug: string };
}): CodeSnippet {
  return {
    id: s.id,
    title: s.title,
    language: s.language.slug as CodeLanguage,
    languageId: s.languageId,
    code: s.code,
    userId: s.userId,
    isPublic: s.isPublic,
    lastRunStatus: s.lastRunStatus,
    createdAt: s.createdAt.toISOString().slice(0, 10),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listUserSnippets(userId: string): Promise<CodeSnippet[]> {
  const rows = await prisma.codeSnippet.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { language: { select: { slug: true } } },
  });

  return rows.map(mapSnippet);
}

export async function getSnippetById(id: string, viewerUserId?: string): Promise<CodeSnippet> {
  const snippet = await prisma.codeSnippet.findUnique({
    where: { id },
    include: { language: { select: { slug: true } } },
  });

  if (!snippet) {
    throw { status: 404, code: 'SNIPPET_NOT_FOUND', message: 'Không tìm thấy snippet' };
  }

  if (!snippet.isPublic && snippet.userId !== viewerUserId) {
    throw {
      status: 403,
      code: 'SNIPPET_PRIVATE',
      message: 'Snippet này ở chế độ riêng tư',
    };
  }

  return mapSnippet(snippet);
}

export async function createSnippet(
  userId: string,
  plan: PlanTier,
  body: CreateSnippetBody
): Promise<CodeSnippet> {
  const limits = getPlanSandboxLimits(plan);
  const currentCount = await prisma.codeSnippet.count({ where: { userId } });

  if (currentCount >= limits.snippetLimit) {
    throw {
      status: 403,
      code: 'SNIPPET_LIMIT_REACHED',
      message: `Bạn đã đạt giới hạn lưu trữ ${limits.snippetLimit} snippets của gói ${plan}. ${
        plan === PlanTier.FREE ? 'Nâng cấp gói PREMIUM để lưu tới 50 snippets.' : ''
      }`.trim(),
      details: {
        used: currentCount,
        limit: limits.snippetLimit,
        plan,
      },
    };
  }

  const language = await resolveLanguage(body.language, body.languageId);

  const created = await prisma.codeSnippet.create({
    data: {
      title: body.title,
      languageId: language.id,
      code: body.code,
      userId,
      isPublic: body.isPublic ?? false,
      lastRunStatus: (body.lastRunStatus as RunStatus | null | undefined) ?? null,
    },
    include: { language: { select: { slug: true } } },
  });

  return mapSnippet(created);
}

export async function deleteSnippet(userId: string, id: string) {
  const snippet = await prisma.codeSnippet.findUnique({ where: { id } });
  if (!snippet) {
    throw { status: 404, code: 'SNIPPET_NOT_FOUND', message: 'Không tìm thấy snippet' };
  }

  if (snippet.userId !== userId) {
    throw {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền xoá snippet này',
    };
  }

  await prisma.codeSnippet.delete({ where: { id } });
  return { id, deleted: true };
}
