import type { CodeLanguage, CodeSnippet, RunResult } from '@devstudy/shared';
import { SNIPPETS } from '../seed/snippets';
import { delay } from './common';

/** Mock Judge0: "chạy" code bằng heuristic đơn giản — đủ để demo stdout/stderr/status. */
export async function runCode(code: string, language: CodeLanguage, stdin: string): Promise<RunResult> {
  await delay(500 + Math.random() * 400);

  if (/error|throw|undefined/i.test(code) && /syntax/i.test(code)) {
    return {
      status: 'CE',
      stdout: '',
      stderr: "error: expected ';' before '}' token\n  (mock Judge0 — lỗi biên dịch)",
      exitCode: 1,
      timeMs: 120,
      memoryMb: 8,
    };
  }

  if (code.includes('while(true)') || code.includes('while (true)') || code.includes('for(;;)')) {
    return {
      status: 'TLE',
      stdout: '',
      stderr: '',
      exitCode: 124,
      timeMs: 2000,
      memoryMb: 64,
    };
  }

  if (code.trim().length < 5) {
    return {
      status: 'CE',
      stdout: '',
      stderr: 'error: empty source (mock Judge0)',
      exitCode: 1,
      timeMs: 80,
      memoryMb: 4,
    };
  }

  // Mô phỏng chạy QuickSort mẫu
  if (code.includes('quickSort') && code.includes('64')) {
    return {
      status: 'AC',
      stdout: '[INFO] Test array initialized\n[RESULT] Sorted array: [11, 12, 22, 25, 34, 64, 90]',
      stderr: '',
      exitCode: 0,
      timeMs: 180,
      memoryMb: 14,
    };
  }

  if (stdin.trim()) {
    return {
      status: 'AC',
      stdout: `[stdin] ${stdin.trim().split('\n')[0]}\nHello from ${language} (mock Judge0)`,
      stderr: '',
      exitCode: 0,
      timeMs: 150,
      memoryMb: 12,
    };
  }

  if (/print\(|cout|System\.out|fmt\.Print/.test(code)) {
    return {
      status: 'AC',
      stdout: 'Hello, DevStudy Hub! (mock Judge0)',
      stderr: '',
      exitCode: 0,
      timeMs: 140,
      memoryMb: 11,
    };
  }

  return {
    status: 'AC',
    stdout: 'Program finished with exit code 0 (mock Judge0 — không có output)',
    stderr: '',
    exitCode: 0,
    timeMs: 110,
    memoryMb: 10,
  };
}

export async function listSnippets(): Promise<CodeSnippet[]> {
  await delay(200);
  return [...SNIPPETS];
}

export async function saveSnippet(s: CodeSnippet): Promise<CodeSnippet> {
  await delay(300);
  SNIPPETS.unshift(s);
  return s;
}
