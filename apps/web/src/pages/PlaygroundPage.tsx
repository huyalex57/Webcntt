import { useRef, useState } from 'react';
import {
  LANGUAGE_LABELS,
  type CodeLanguage,
  type CodeSnippet,
  type RunResult,
} from '@devstudy/shared';
import { useRunCode, useSaveSnippet, useSnippets } from '../features/playground/api';
import { SnippetList, TerminalOutput } from '../features/playground/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { playgroundLimits, runQuotaLimit, snippetLimit } from '../lib/gating';
import { addDailyCount, getDailyCount } from '../lib/utils';
import { QUICKSORT_CPP } from '../lib/seed';
import { Badge, Button, Card, Field, PageHeader, Select, Textarea } from '../components/ui';

const TEMPLATES: Record<CodeLanguage, string> = {
  cpp: QUICKSORT_CPP,
  python:
    '# DevStudy Hub • Python 3.12\ndef main():\n    print("Hello, DevStudy Hub!")\n\nif __name__ == "__main__":\n    main()',
  java:
    '// DevStudy Hub • Java 21\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DevStudy Hub!");\n    }\n}',
  c:
    '#include <stdio.h>\n// DevStudy Hub • C (GCC 13.2)\nint main() {\n    printf("Hello, DevStudy Hub!\\n");\n    return 0;\n}',
  go:
    'package main\n// DevStudy Hub • Go 1.22\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, DevStudy Hub!")\n}',
};

export default function PlaygroundPage() {
  const { user } = useAuth();
  const toast = useToast();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const limits = playgroundLimits(session);

  const [lang, setLang] = useState<CodeLanguage>('cpp');
  const [code, setCode] = useState(TEMPLATES.cpp);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [runsUsed, setRunsUsed] = useState(() => getDailyCount('runs-used'));
  const [snippetTitle, setSnippetTitle] = useState('main.cpp');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const runMutation = useRunCode();
  const { data: snippets = [] } = useSnippets();
  const saveMutation = useSaveSnippet();

  const doRun = async () => {
    if (runsUsed >= runQuotaLimit(session)) {
      toast.push(
        `Hết lượt chạy hôm nay (${runQuotaLimit(session)} lần cho gói Free). Nâng cấp Premium để chạy 200 lần/ngày.`,
        'error'
      );
      return;
    }
    const res = await runMutation.mutateAsync({ code, language: lang, stdin });
    setResult(res);
    setRunsUsed(addDailyCount('runs-used', 1));
  };

  const doSave = async () => {
    if (snippets.length >= snippetLimit(session)) {
      toast.push(
        `Đã đạt giới hạn snippet của gói ${user?.plan ?? 'FREE'} (${snippetLimit(session)} snippet).`,
        'error'
      );
      return;
    }
    const s: CodeSnippet = {
      id: `sn-${Date.now()}`,
      title: snippetTitle || `main.${lang === 'cpp' ? 'cpp' : lang === 'python' ? 'py' : lang}`,
      language: lang,
      code,
      createdAt: new Date().toISOString().slice(0, 10),
      lastRunStatus: result?.status,
    };
    await saveMutation.mutateAsync(s);
    toast.push(`Đã lưu snippet “${s.title}”`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = ta;
      ta.setRangeText('    ', s, en, 'end');
      setCode(ta.value);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void doRun();
    }
  };

  const handleSelectSnippet = (s: CodeSnippet) => {
    setLang(s.language);
    setCode(s.code);
    setSnippetTitle(s.title);
    toast.push(`Đã mở snippet “${s.title}”`);
  };

  const lines = code.split('\n').length;

  return (
    <div>
      <PageHeader
        title="Code Playground (Judge0)"
        subtitle="Môi trường code C/C++, Python, Java, Go trong sandbox cô lập (Docker isolate · gVisor · No Net). Ctrl+Enter để chạy."
        actions={<Badge color="navy">{limits.label}</Badge>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>
          Bộ nhớ Sandbox: {limits.ramMb} MB / {user?.plan === 'PREMIUM' ? '1 GB' : '1 GB'}
        </span>
        <span>·</span>
        <span>
          Lượt chạy hôm nay: {runsUsed}/{runQuotaLimit(session)}
        </span>
        <span>·</span>
        <span>
          Snippet đã lưu: {snippets.length}/{snippetLimit(session)}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Field label="Ngôn ngữ">
              <Select
                value={lang}
                onChange={(e) => {
                  const l = e.target.value as CodeLanguage;
                  setLang(l);
                  setCode(TEMPLATES[l]);
                  setResult(null);
                }}
                className="w-56"
              >
                {(Object.keys(LANGUAGE_LABELS) as CodeLanguage[]).map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tên file">
              <input
                className="rounded border border-border-strong px-3 py-2 text-sm"
                value={snippetTitle}
                onChange={(e) => setSnippetTitle(e.target.value)}
              />
            </Field>
            <div className="ml-auto flex gap-2 pt-5">
              <Button variant="outline" onClick={doSave}>
                Lưu Snippet
              </Button>
              <Button onClick={doRun} disabled={runMutation.isPending}>
                {runMutation.isPending ? 'Đang chạy…' : '▶ Chạy Code (Ctrl+Enter)'}
              </Button>
            </div>
          </div>
          <div className="flex overflow-hidden rounded border border-border-strong">
            <div className="select-none bg-slate-100 px-2 py-3 text-right font-mono text-xs leading-6 text-slate-400">
              {Array.from({ length: lines }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={taRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="min-h-[380px] w-full resize-y bg-white p-3 font-mono text-[13px] leading-6 outline-none"
              aria-label="Code editor (placeholder cho Monaco Editor)"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Editor hiện tại là textarea có hỗ trợ Tab + line numbers (placeholder). Khi tích hợp thật sẽ thay
            bằng Monaco Editor — xem README.
          </p>
          <Field label="Input (stdin)">
            <Textarea
              rows={3}
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Nhập dữ liệu đầu vào, mỗi test trên một dòng…"
            />
          </Field>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <h3 className="font-semibold">Terminal Output (stdout / stderr)</h3>
            <TerminalOutput result={result} isPending={runMutation.isPending} />
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold">Snippets của tôi</h3>
            <div className="mt-3">
              <SnippetList snippets={snippets} onSelectSnippet={handleSelectSnippet} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
