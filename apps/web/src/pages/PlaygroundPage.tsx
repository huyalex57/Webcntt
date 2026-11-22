import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  LANGUAGE_EXT,
  LANGUAGE_LABELS,
  type CodeLanguage,
  type CodeSnippet,
  type RunResult,
} from '@devstudy/shared';
import {
  useCodeQuota,
  useDeleteSnippet,
  useLanguages,
  useRunCode,
  useSaveSnippet,
  useSnippet,
  useSnippets,
} from '../features/playground/api';
import {
  MonacoCodeEditor,
  SnippetList,
  TerminalOutput,
} from '../features/playground/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { playgroundLimits, runQuotaLimit, snippetLimit } from '../lib/gating';
import { QUICKSORT_CPP } from '../lib/seed';
import {
  Badge,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  QuotaBar,
  Select,
  Textarea,
} from '../components/ui';

const FALLBACK_TEMPLATES: Record<CodeLanguage, string> = {
  cpp: QUICKSORT_CPP,
  python:
    '# DevStudy Hub • Python 3\ndef main():\n    print("Hello, DevStudy Hub!")\n\nif __name__ == "__main__":\n    main()',
  java:
    '// DevStudy Hub • Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DevStudy Hub!");\n    }\n}',
  c:
    '#include <stdio.h>\n// DevStudy Hub • C (GCC)\nint main() {\n    printf("Hello, DevStudy Hub!\\n");\n    return 0;\n}',
  go:
    'package main\n// DevStudy Hub • Go\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, DevStudy Hub!")\n}',
};

export default function PlaygroundPage() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const sharedSnippetId = searchParams.get('snippet');

  const session = user ? { role: user.role, plan: user.plan } : null;
  const fallbackLimits = playgroundLimits(session);

  const { data: languages = [] } = useLanguages();
  const { data: quotaData } = useCodeQuota(Boolean(user));
  const { data: snippets = [] } = useSnippets(Boolean(user));
  const { data: sharedSnippet } = useSnippet(sharedSnippetId);

  const runMutation = useRunCode();
  const saveMutation = useSaveSnippet();
  const deleteMutation = useDeleteSnippet();

  const [lang, setLang] = useState<CodeLanguage>('cpp');
  const [code, setCode] = useState(FALLBACK_TEMPLATES.cpp);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [runsUsedOverride, setRunsUsedOverride] = useState<number | null>(null);
  const [snippetTitle, setSnippetTitle] = useState('main.cpp');
  const [isPublicSnippet, setIsPublicSnippet] = useState(true);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Monaco Editor Options
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(4);

  const templateMap = useMemo(() => {
    const map: Record<CodeLanguage, string> = { ...FALLBACK_TEMPLATES };
    for (const l of languages) {
      map[l.slug] = l.starterCode;
    }
    return map;
  }, [languages]);

  const currentLangInfo = useMemo(
    () => languages.find((l) => l.slug === lang),
    [languages, lang]
  );

  // Load shared snippet from URL (?snippet=...)
  useEffect(() => {
    if (sharedSnippet) {
      setLang(sharedSnippet.language);
      setCode(sharedSnippet.code);
      setSnippetTitle(sharedSnippet.title);
      toast.push(`Đã nạp snippet chia sẻ “${sharedSnippet.title}”`, 'info');
    }
  }, [sharedSnippet]);

  // Sync quota count from backend when user switches or quota refreshes
  useEffect(() => {
    if (quotaData) {
      setRunsUsedOverride(quotaData.used);
    } else if (!user) {
      setRunsUsedOverride(0);
    }
  }, [quotaData, user]);

  const runsUsed = runsUsedOverride ?? quotaData?.used ?? 0;
  const maxRuns = quotaData?.limit ?? runQuotaLimit(session);
  const maxSnippets = quotaData?.limits?.snippetLimit ?? snippetLimit(session);
  const ramMb = quotaData?.limits?.memoryLimitMb ?? fallbackLimits.ramMb;
  const cpuLimitS = quotaData?.limits?.cpuTimeLimitS ?? fallbackLimits.timeoutS;

  const doRun = useCallback(async () => {
    if (runMutation.isPending) return;

    if (!user) {
      toast.push('Vui lòng đăng nhập để sử dụng Code Playground', 'info');
      nav('/login', { state: { redirect: '/playground' } });
      return;
    }

    if (runsUsed >= maxRuns) {
      setQuotaModalOpen(true);
      return;
    }

    try {
      const res = await runMutation.mutateAsync({
        code,
        language: lang,
        languageId: currentLangInfo?.id,
        stdin,
      });
      setResult(res);
      if (res.quota) {
        setRunsUsedOverride(res.quota.used);
      } else {
        setRunsUsedOverride((prev) => (prev ?? runsUsed) + 1);
      }
    } catch (err: any) {
      if (err?.status === 429 || err?.code === 'QUOTA_EXCEEDED') {
        if (err?.details?.limit) {
          setRunsUsedOverride(err.details.limit);
        }
        setQuotaModalOpen(true);
        toast.push(
          err?.message || 'Bạn đã dùng hết hạn mức chạy code trong ngày hôm nay.',
          'error'
        );
        return;
      }
      toast.push(err?.message || 'Không thể thực thi mã nguồn lúc này.', 'error');
    }
  }, [
    runMutation,
    user,
    runsUsed,
    maxRuns,
    code,
    lang,
    currentLangInfo,
    stdin,
    toast,
    nav,
  ]);

  const doSave = async () => {
    if (!user) {
      toast.push('Vui lòng đăng nhập để lưu code snippet', 'info');
      nav('/login', { state: { redirect: '/playground' } });
      return;
    }

    if (snippets.length >= maxSnippets) {
      toast.push(
        `Đã đạt giới hạn lưu trữ của gói ${user.plan} (${maxSnippets} snippet). Nâng cấp Premium để lưu tới 50 snippets.`,
        'error'
      );
      return;
    }

    const title = snippetTitle.trim() || `main.${LANGUAGE_EXT[lang]}`;
    try {
      await saveMutation.mutateAsync({
        title,
        language: lang,
        languageId: currentLangInfo?.id,
        code,
        isPublic: isPublicSnippet,
        lastRunStatus: result?.status ?? null,
      });
      toast.push(`Đã lưu snippet “${title}”`);
    } catch (err: any) {
      toast.push(err?.message || 'Không thể lưu snippet', 'error');
    }
  };

  const handleSelectSnippet = (s: CodeSnippet) => {
    setLang(s.language);
    setCode(s.code);
    setSnippetTitle(s.title);
    setIsPublicSnippet(Boolean(s.isPublic));
    setResult(null);
    toast.push(`Đã mở snippet “${s.title}”`);
  };

  const handleDeleteSnippet = async (s: CodeSnippet) => {
    setDeletingId(s.id);
    try {
      await deleteMutation.mutateAsync(s.id);
      toast.push(`Đã xoá snippet “${s.title}”`);
    } catch (err: any) {
      toast.push(err?.message || 'Không thể xoá snippet', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShareSnippet = async (s: CodeSnippet) => {
    const shareUrl = `${window.location.origin}/playground?snippet=${s.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.push('Đã sao chép liên kết chia sẻ snippet vào clipboard!');
    } catch {
      toast.push(`Link chia sẻ: ${shareUrl}`, 'info');
    }
  };

  const handleLanguageChange = (nextLang: CodeLanguage) => {
    setLang(nextLang);
    setCode(templateMap[nextLang] || FALLBACK_TEMPLATES[nextLang]);
    setSnippetTitle(`main.${LANGUAGE_EXT[nextLang]}`);
    setResult(null);
  };

  const languageOptions =
    languages.length > 0
      ? languages.map((l) => ({ slug: l.slug, label: l.name }))
      : (Object.keys(LANGUAGE_LABELS) as CodeLanguage[]).map((slug) => ({
          slug,
          label: LANGUAGE_LABELS[slug],
        }));

  return (
    <div>
      <PageHeader
        title="Code Playground (Monaco Editor & Judge0)"
        subtitle="Môi trường chạy code C, C++, Python, Java, Go trong sandbox Judge0 cô lập (No Net · Read-Only FS · CPU/RAM limits). Hỗ trợ Ctrl+Enter."
        actions={
          <Badge color="navy">
            {user?.plan === 'PREMIUM' ? 'Premium' : 'Free'}: {ramMb} MB RAM / {cpuLimitS}s
          </Badge>
        }
      />

      {/* Quota & Sandbox limits bar */}
      <Card className="mb-4 p-4">
        <div className="grid gap-4 md:grid-cols-3 md:items-center">
          <div className="md:col-span-2">
            <QuotaBar
              used={runsUsed}
              limit={maxRuns}
              label={`Lượt chạy code hôm nay (${user?.plan ?? 'FREE'})`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 md:justify-end">
            <span>
              RAM: <strong>{ramMb} MB</strong> · CPU: <strong>{cpuLimitS}s</strong>
            </span>
            <span>·</span>
            <span>
              Snippets: <strong>{snippets.length}/{maxSnippets}</strong>
            </span>
            {user?.plan !== 'PREMIUM' && (
              <Link to="/pricing" className="font-semibold text-primary hover:underline">
                Nâng cấp Premium →
              </Link>
            )}
          </div>
        </div>
      </Card>

      {!user && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Bạn đang xem ở chế độ khách (Guest).{' '}
          <Link to="/login" className="font-semibold underline">
            Đăng nhập ngay
          </Link>{' '}
          để chạy code trên Judge0 sandbox (30 lượt/ngày miễn phí) và lưu snippets cá nhân.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          {/* Top toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Field label="Ngôn ngữ">
                <Select
                  value={lang}
                  onChange={(e) => handleLanguageChange(e.target.value as CodeLanguage)}
                  className="w-44"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>
                💡 Nhấn{' '}
                <kbd className="rounded border bg-slate-100 px-1 font-mono">Ctrl+Enter</kbd> để chạy
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPublicSnippet}
                  onChange={(e) => setIsPublicSnippet(e.target.checked)}
                />
                <span>Cho phép chia sẻ link</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={doSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Đang lưu…' : 'Lưu Snippet'}
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
            <h3 className="font-semibold text-ink">Terminal Output (stdout / stderr / compiler)</h3>
            <div className="mt-2">
              <TerminalOutput result={result} isPending={runMutation.isPending} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Snippets của tôi</h3>
              <span className="text-xs text-slate-400">
                {snippets.length}/{maxSnippets}
              </span>
            </div>
            <div className="mt-3">
              <SnippetList
                snippets={snippets}
                onSelectSnippet={handleSelectSnippet}
                onDeleteSnippet={handleDeleteSnippet}
                onShareSnippet={handleShareSnippet}
                deletingId={deletingId}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Quota Exceeded (HTTP 429) Upgrade Modal */}
      <Modal
        open={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        title="Đã hết lượt chạy code trong ngày"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Bạn đã sử dụng hết <strong>{maxRuns} lượt chạy code/ngày</strong> của gói{' '}
            <strong>{user?.plan ?? 'FREE'}</strong>.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
            <p className="font-semibold">Quyền lợi gói PREMIUM:</p>
            <p>✓ 200 lượt chạy code/ngày (gấp gần 7 lần gói Free)</p>
            <p>✓ Sandbox nâng cấp: 5s CPU, 512 MB RAM, stdin tới 1 MB</p>
            <p>✓ Lưu trữ tới 50 code snippets cá nhân</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuotaModalOpen(false)}>
              Để sau
            </Button>
            <Link to="/pricing">
              <Button>Nâng cấp PREMIUM →</Button>
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}
