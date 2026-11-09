import { useMutation } from '@tanstack/react-query';
import { runCode } from '../../lib/api';
import type { CodeLanguage } from '@devstudy/shared';
export const useRunCode = () => useMutation({ mutationFn: (v: { code: string; language: CodeLanguage; stdin: string }) => runCode(v.code, v.language, v.stdin) });
