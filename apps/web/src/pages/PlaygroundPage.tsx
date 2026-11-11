import { useState } from 'react';
import {
  LANGUAGE_LABELS,
  type CodeLanguage,
  type CodeSnippet,
  type RunResult,
} from '@devstudy/shared';
import { useRunCode, useSaveSnippet, useSnippets } from '../features/playground/api';
import {
  MonacoCodeEditor,
  SnippetList,
  TerminalOutput,
} from '../features/playground/components';
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

  // Monaco Editor Options
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(4);

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

  const handleSelectSnippet = (s: CodeSnippet) => {
    setLang(s.language);
    setCode(s.code);
    setSnippetTitle(s.title);
    toast.push(`Đã mở snippet “${s.title}”`);
  };

  return (
    <div>
      <PageHeader
        title="Code Playground (Monaco Editor & Judge0)"
        subtitle="Môi trường code C/C++, Python, Java, Go trong sandbox cô lập (Docker isolate · gVisor · No Net). Hỗ trợ phím tắt Ctrl+Enter."
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
          {/* Top toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Field label="Ngôn ngữ">
                <Select
                  value={lang}
                  onChange={(e) => {
                    const l = e.target.value as CodeLanguage;
                    setLang(l);
                    setCode(TEMPLATES[l]);
                    setResult(null);
                  }}
                  className="w-40"
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
                  className="rounded border border-border-strong px-3 py-1.5 text-sm"
                  value={snippetTitle}
                  onChange={(e) => setSnippetTitle(e.target.value)}
                />
              </Field>
            </div>

            {/* Editor customizations */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditorTheme((t) => (t === 'vs-dark' ? 'light' : 'vs-dark'))}
                className="rounded border border-border px-2.5 py-1 text-slate-600 hover:bg-surface font-medium transition-colors"
                title="Chuyển theme sáng/tối"
              >
                {editorTheme === 'vs-dark' ? '🌙 Dark' : '☀️ Light'}
              </button>

              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="rounded border border-border px-2 py-1 text-slate-600 text-xs"
                title="Cỡ chữ"
              >
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
              </select>

              <select
                value={tabSize}
                onChange={(e) => setTabSize(Number(e.target.value))}
                className="rounded border border-border px-2 py-1 text-slate-600 text-xs"
                title="Tab size"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>
          </div>

          {/* Monaco Editor Component */}
          <MonacoCodeEditor
            language={lang}
            value={code}
            onChange={setCode}
            onRun={doRun}
            theme={editorTheme}
            fontSize={fontSize}
            tabSize={tabSize}
            height="440px"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              💡 Mẹo: Nhấn <kbd className="rounded border bg-slate-100 px-1 font-mono">Ctrl+Enter</kbd> (hoặc <kbd className="rounded border bg-slate-100 px-1 font-mono">Cmd+Enter</kbd>) để chạy code nhanh
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={doSave}>
                Lưu Snippet
              </Button>
              <Button onClick={doRun} disabled={runMutation.isPending}>
                {runMutation.isPending ? 'Đang chạy…' : '▶ Chạy Code'}
              </Button>
            </div>
          </div>

          {/* Stdin panel */}
          <div className="mt-4">
            <Field label="Standard Input (stdin)">
              <Textarea
                rows={3}
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Nhập dữ liệu đầu vào cho chương trình nếu có…"
                className="font-mono text-xs"
              />
            </Field>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <h3 className="font-semibold text-ink">Terminal Output (stdout / stderr)</h3>
            <div className="mt-2">
              <TerminalOutput result={result} isPending={runMutation.isPending} />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-ink">Snippets của tôi</h3>
            <div className="mt-3">
              <SnippetList snippets={snippets} onSelectSnippet={handleSelectSnippet} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
