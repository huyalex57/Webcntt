import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LANGUAGE_LABELS, type CodeLanguage } from '@devstudy/shared';
import { useExam } from '../features/exams/api';
import { runCode } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, Field, Select, Textarea } from '../components/ui';

export default function ExamDetailPage() {
  const { id = '' } = useParams();
  const { data: exam, isLoading } = useExam(id);
  const toast = useToast();
  const [problemIdx, setProblemIdx] = useState(0);
  const [lang, setLang] = useState<CodeLanguage>('cpp');
  const [code, setCode] = useState('// Viết lời giải tại đây\n');
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [submitted, setSubmitted] = useState<Record<string, { status: string; passed: number; total: number }>>({});
  const [autosavedAt, setAutosavedAt] = useState<string>('');
  const problem = exam?.problems[problemIdx];
  const totalPoints = useMemo(() => (exam?.problems ?? []).reduce((s, p) => s + p.points, 0), [exam]);

  useEffect(() => { if (exam) setSecondsLeft(exam.durationMin * 60); }, [exam]);
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (code.trim().length > 5) setAutosavedAt(new Date().toLocaleTimeString('vi-VN')); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  useEffect(() => { if (secondsLeft === 0 && exam) toast.push('Hết giờ — bài làm đã được tự động nộp (mock)', 'info'); }, [secondsLeft, exam, toast]);

  if (isLoading) return <p className="text-sm text-slate-500">Đang tải kỳ thi…</p>;
  if (!exam || !problem) return <EmptyState title="Không tìm thấy kỳ thi hoặc chưa có bài tập" action={<Link to="/exams"><Button>Về danh sách thi</Button></Link>} />;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const submit = async () => {
    let passedCount = 0;
    let overallStatus = 'AC';
    for (const tc of problem.testCases) {
      const res = await runCode(code, lang, tc.input);
      if (res.status !== 'AC') {
        overallStatus = res.status;
      } else {
        passedCount++;
      }
    }
    const total = problem.testCases.length;
    setSubmitted((s) => ({ ...s, [problem.id]: { status: overallStatus, passed: passedCount, total } }));
    toast.push(`Đã nộp bài “${problem.title}”: ${overallStatus} — ${passedCount}/${total} test`);
  };
  const score = Object.entries(submitted).reduce((sum, [pid, r]) => { const p = exam.problems.find((x) => x.id === pid); return sum + (p ? Math.round(p.points * r.passed / Math.max(1, r.total)) : 0); }, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{exam.title}</h1><p className="text-sm text-slate-500">{exam.creator} · {exam.problems.length} bài · Tổng {totalPoints} điểm · Điểm hiện tại: {score}/{totalPoints}</p></div>
        <Card className="px-4 py-2 text-center"><p className="text-xs text-slate-500">Thời gian còn lại (server-mock)</p><p className={`font-mono text-2xl font-bold ${secondsLeft < 300 ? 'text-red-600' : ''}`}>{mm}:{ss}</p>{autosavedAt && <p className="text-xs text-slate-400">Autosave: {autosavedAt}</p>}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap gap-2">{exam.problems.map((p, i) => <button key={p.id} onClick={() => setProblemIdx(i)} className={`rounded border px-3 py-1.5 text-sm font-medium ${i === problemIdx ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white'}`}>Bài {i + 1}: {p.points}đ</button>)}</div>
          <h2 className="mt-4 text-lg font-bold">{problem.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{problem.statement}</p>
          <p className="mt-3 text-xs text-slate-500">Giới hạn: {problem.timeLimitMs}ms · {problem.memoryLimitMb} MB · Ngôn ngữ cho phép: {exam.languages.map((l) => LANGUAGE_LABELS[l]).join(', ')}</p>
          <h3 className="mt-4 font-semibold">Test case</h3>
          <ul className="mt-2 space-y-2">{problem.testCases.map((t) => (
            <li key={t.id} className="rounded border border-border bg-surface p-3 font-mono text-xs">
              {t.hidden ? <span className="text-slate-500">Test ẩn — {t.points} điểm (không hiển thị input/output)</span> : <><p>Input: {t.input}</p><p>Expected: {t.expectedOutput}</p><p className="text-slate-500">{t.points} điểm</p></>}
            </li>))}</ul>
          {submitted[problem.id] && <p className="mt-3 text-sm font-semibold">Kết quả nộp: {submitted[problem.id].status} — {submitted[problem.id].passed}/{submitted[problem.id].total} test</p>}
        </Card>
        <Card className="p-5 lg:col-span-3">
          <div className="mb-3 flex gap-2">
            <Field label="Ngôn ngữ"><Select value={lang} onChange={(e) => setLang(e.target.value as CodeLanguage)} className="w-48">{exam.languages.map((l) => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}</Select></Field>
            <div className="ml-auto pt-5"><Button onClick={submit}>Nộp bài</Button></div>
          </div>
          <Textarea rows={16} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-[13px] leading-6" spellCheck={false} />
          <p className="mt-2 text-xs text-slate-500">Bài làm được autosave mỗi 15 giây (mô phỏng PUT /attempts/:id/answers). Nộp bài sẽ chấm với test case qua hàng đợi (mock đồng bộ).</p>
        </Card>
      </div>
    </div>
  );
}
