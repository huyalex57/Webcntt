import { RunStatus } from '@prisma/client';
import { env } from '../../config/env.js';

export interface Judge0ExecuteParams {
  sourceCode: string;
  languageId: number;
  stdin: string;
  cpuTimeLimitS: number;
  wallTimeLimitS: number;
  memoryLimitKb: number;
}

export interface Judge0NormalizedResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number;
  timeMs: number;
  memoryKb: number;
  memoryMb: number;
}

interface Judge0ApiResponse {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
  exit_code: number | null;
  status?: {
    id: number;
    description: string;
  };
}

function encodeBase64(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

function decodeBase64(input: string | null | undefined): string {
  if (!input) return '';
  try {
    return Buffer.from(input, 'base64').toString('utf8');
  } catch {
    return input;
  }
}

export function mapJudge0Status(
  statusId: number,
  memoryKb: number,
  memoryLimitKb: number,
  stderr: string,
  message: string
): RunStatus {
  // Judge0 status codes:
  // 3: Accepted
  // 4: Wrong Answer
  // 5: Time Limit Exceeded
  // 6: Compilation Error
  // 7..12: Runtime Error (SIGSEGV, SIGXFSZ, SIGFPE, SIGABRT, NZEC, Other)
  // 13: Internal Error, 14: Exec Format Error
  if (statusId === 3) return RunStatus.AC;
  if (statusId === 4) return RunStatus.WA;
  if (statusId === 5) return RunStatus.TLE;
  if (statusId === 6) return RunStatus.CE;

  const combined = `${stderr}\n${message}`.toLowerCase();
  if (
    memoryKb >= memoryLimitKb ||
    combined.includes('memoryerror') ||
    combined.includes('out of memory') ||
    combined.includes('bad_alloc') ||
    combined.includes('memory limit')
  ) {
    return RunStatus.MLE;
  }

  return RunStatus.RE;
}

export async function executeInJudge0(
  params: Judge0ExecuteParams
): Promise<Judge0NormalizedResult> {
  const baseUrl = env.JUDGE0_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/submissions?base64_encoded=true&wait=true`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.JUDGE0_API_KEY) {
    headers['X-Auth-Token'] = env.JUDGE0_API_KEY;
  }

  const controller = new AbortController();
  const timeoutMs = (params.wallTimeLimitS + 10) * 1000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        source_code: encodeBase64(params.sourceCode),
        language_id: params.languageId,
        stdin: encodeBase64(params.stdin),
        cpu_time_limit: params.cpuTimeLimitS,
        wall_time_limit: params.wallTimeLimitS,
        memory_limit: params.memoryLimitKb,
        max_processes_and_or_threads: 60,
        enable_network: false,
        max_file_size: 4096,
      }),
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        status: RunStatus.TLE,
        stdout: '',
        stderr: 'Quá thời gian thực thi tối đa (Sandbox timeout)',
        compileOutput: '',
        exitCode: 124,
        timeMs: params.wallTimeLimitS * 1000,
        memoryKb: 0,
        memoryMb: 0,
      };
    }

    throw {
      status: 503,
      code: 'SANDBOX_UNAVAILABLE',
      message:
        'Dịch vụ Sandbox Judge0 hiện không khả dụng. Vui lòng kiểm tra container Judge0 (docker compose up -d judge0-server judge0-worker).',
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw {
      status: 502,
      code: 'SANDBOX_ERROR',
      message: `Judge0 sandbox trả về lỗi HTTP ${response.status}`,
      details: errText.slice(0, 500),
    };
  }

  const payload = (await response.json()) as Judge0ApiResponse;

  const stdout = decodeBase64(payload.stdout);
  const stderr = decodeBase64(payload.stderr);
  const compileOutput = decodeBase64(payload.compile_output);
  const message = decodeBase64(payload.message);

  const timeSeconds = payload.time ? parseFloat(payload.time) : 0;
  const timeMs = Number.isFinite(timeSeconds) ? Math.round(timeSeconds * 1000) : 0;
  const memoryKb = typeof payload.memory === 'number' && Number.isFinite(payload.memory) ? Math.round(payload.memory) : 0;
  const memoryMb = Number((memoryKb / 1024).toFixed(2));
  const statusId = payload.status?.id ?? 13;

  const status = mapJudge0Status(statusId, memoryKb, params.memoryLimitKb, stderr, message);

  let exitCode = payload.exit_code ?? (status === RunStatus.AC ? 0 : 1);
  if (status === RunStatus.TLE && exitCode === 0) exitCode = 124;

  const normalizedStderr = [stderr, message].filter(Boolean).join('\n').trim();

  return {
    status,
    stdout,
    stderr: normalizedStderr,
    compileOutput: compileOutput.trim(),
    exitCode,
    timeMs,
    memoryKb,
    memoryMb,
  };
}
