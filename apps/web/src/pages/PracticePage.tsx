import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEVEL_LABELS, QUESTION_TYPE_LABELS, TOPIC_LABELS, type Level, type PracticeSet, type QuestionType, type Topic } from '@devstudy/shared';
import { useGeneratePracticeSet } from '../features/ai-practice/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { aiQuotaLimit } from '../lib/gating';
import { addDailyCount, getDailyCount, loadJSON, saveJSON } from '../lib/utils';
import { Badge, Button, Card, Field, PageHeader, QuotaBar, Select } from '../components/ui';
import type { SkillProfile } from '@devstudy/shared';

const DEFAULT_SKILLS: SkillProfile[] = [
  { topic: 'CTDL', accuracy: 86, answered: 42, weak: false },
  { topic: 'OOP', accuracy: 78, answered: 30, weak: false },
  { topic: 'CSDL', accuracy: 64, answered: 25, weak: true },
  { topic: 'MANG', accuracy: 71, answered: 18, weak: false },
  { topic: 'HDH', accuracy: 58, answered: 20, weak: true },
];

export default function PracticePage() {
  const { user } = useAuth(); const toast = useToast();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const quotaLimit = aiQuotaLimit(session);
  const [used, setUsed] = useState(() => getDailyCount('ai-used'));
  const [topic, setTopic] = useState<Topic>('CTDL');
  const [level, setLevel] = useState<Level>('TRUNG_BINH');
  const [count, setCount] = useState(5);
  const [qtype, setQtype] = useState<QuestionType>('MCQ');
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [skills, setSkills] = useState<SkillProfile[]>(() => loadJSON<SkillProfile[]>('skill-profile', DEFAULT_SKILLS));
  const gen = useGeneratePracticeSet();

  const remaining = quotaLimit === Infinity ? Infinity : Math.max(0, quotaLimit - used);
  const generate = async () => {
    if (remaining < count) { toast.push(`Hết quota Free hôm nay (còn ${remaining} câu). Nâng cấp Premium để luyện không giới hạn.`, 'error'); return; }
    const ps = await gen.mutateAsync({ topic, level, count, type: qtype });
    setUsed(addDailyCount('ai-used', ps.questions.length));
    setSet(ps); setIdx(0); setPicked(null); setAnswers({}); setSubmitted(false);
  };
  const current = set?.questions[idx];
  const check = () => { if (picked === null || !current) return; setAnswers((a) => ({ ...a, [current.id]: picked })); };
  const submit = () => {
    if (!set) return;
    const correct = set.questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const score = Math.round((correct / set.questions.length) * 100);
    setSubmitted(true);
    const next = skills.map((s) => s.topic === set.topic ? { ...s, answered: s.answered + set.questions.length, accuracy: Math.round((s.accuracy * s.answered + score) / (s.answered + set.questions.length) || score), weak: score < 70 } : s);
    setSkills(next); saveJSON('skill-profile', next);
    toast.push(`Đã nộp bài: ${correct}/${set.questions.length} đúng (${score}%) — SkillProfile đã cập nhật`);
  };
  const weakTopics = useMemo(() => skills.filter((s) => s.weak), [skills]);

  return (
    <div>
      <PageHeader title="AI Luyện tập & Ôn thi cá nhân hoá" subtitle="Module luyện tập thích ứng — sinh câu hỏi theo chủ đề, trình độ và lịch sử trả lời sai của bạn (workflow §5.4)." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold">Tạo bộ câu hỏi mới</h3>
          <div className="mt-3 space-y-3">
            <Field label="Chủ đề"><Select value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>{(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}</Select></Field>
            <Field label="Trình độ"><Select value={level} onChange={(e) => setLevel(e.target.value as Level)}>{(Object.keys(LEVEL_LABELS) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</Select></Field>
            <Field label="Số câu hỏi"><Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 5, 10].map((n) => <option key={n} value={n}>{n} câu</option>)}</Select></Field>
            <Field label="Dạng câu hỏi"><Select value={qtype} onChange={(e) => setQtype(e.target.value as QuestionType)}>{(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</Select></Field>
            <div className="rounded border border-border bg-surface p-3"><QuotaBar used={used} limit={quotaLimit} label="Quota AI hôm nay" /><p className="mt-1 text-xs text-slate-500">Free: 10 câu/ngày, reset 00:00. Premium: không giới hạn + phân tích sâu.</p></div>
            <Button className="w-full" disabled={gen.isPending} onClick={generate}>{gen.isPending ? 'AI đang sinh câu hỏi…' : 'Tạo bộ câu hỏi'}</Button>
            {remaining < count && <p className="text-sm text-red-600">Hết quota Free — <Link to="/pricing" className="font-semibold underline">nâng cấp Premium</Link> để tiếp tục (mock trả 429).</p>}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="font-semibold">Hồ sơ năng lực (SkillProfile)</h4>
            {skills.map((s) => (
              <div key={s.topic} className="mt-2"><div className="flex justify-between text-xs"><span>{TOPIC_LABELS[s.topic]}</span><span>{s.accuracy}% · {s.answered} câu {s.weak && '· cần ôn'}</span></div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${s.accuracy < 70 ? 'bg-amber-500' : 'bg-tertiary'}`} style={{ width: `${s.accuracy}%` }} /></div></div>
            ))}
            {weakTopics.length > 0 && <p className="mt-2 text-xs text-amber-700">Điểm yếu cần ôn: {weakTopics.map((s) => TOPIC_LABELS[s.topic]).join(', ')}</p>}
          </div>
        </Card>
        <div className="lg:col-span-2">
          {!set ? (
            <Card className="p-6"><h3 className="font-semibold">Chưa có bộ câu hỏi</h3><p className="mt-1 text-sm text-slate-600">Chọn chủ đề, trình độ và số câu rồi bấm “Tạo bộ câu hỏi”. Câu hỏi được sinh từ ngân hàng mẫu (bản thật gọi LLM qua AI service, validate Zod).</p></Card>
          ) : submitted ? (
            <Card className="p-6">
              <h3 className="font-semibold">Kết quả: {set.questions.filter((q) => answers[q.id] === q.correctIndex).length}/{set.questions.length} đúng ({Math.round(set.questions.filter((q) => answers[q.id] === q.correctIndex).length / set.questions.length * 100)}%)</h3>
              <div className="mt-4 space-y-4">{set.questions.map((q, i) => (
                <div key={q.id} className="rounded border border-border p-4">
                  <p className="text-sm font-medium">Câu {i + 1}: {q.prompt}</p>
                  <p className={`mt-1 text-sm ${answers[q.id] === q.correctIndex ? 'text-emerald-700' : 'text-red-700'}`}>{answers[q.id] === q.correctIndex ? '✓ Đúng' : `✗ Sai — đáp án đúng: ${q.options[q.correctIndex]}`}</p>
                  <p className="mt-1 text-sm text-slate-600"><span className="font-medium">Giải thích AI Mentor:</span> {q.explanation}</p>
                </div>))}
              </div>
              <Button className="mt-4" variant="outline" onClick={() => setSet(null)}>Luyện bộ mới</Button>
            </Card>
          ) : current ? (
            <Card className="p-6">
              <div className="flex items-center justify-between"><Badge color="navy">{TOPIC_LABELS[set.topic]} · {LEVEL_LABELS[set.level]}</Badge><span className="text-sm text-slate-500">Câu hỏi {idx + 1} / {set.questions.length} · Độ khó: {current.difficulty}</span></div>
              <p className="mt-3 font-medium leading-relaxed">{current.prompt}</p>
              {current.code && <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{current.code}</pre>}
              <div className="mt-4 space-y-2">
                {current.options.map((op, i) => (
                  <button key={i} onClick={() => setPicked(i)} className={`block w-full rounded border px-4 py-2.5 text-left text-sm ${picked === i ? 'border-primary bg-blue-50' : 'border-border-strong bg-white hover:bg-surface'}`}><span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {op}</button>
                ))}
              </div>
              {picked !== null && answers[current.id] !== undefined && (
                <div className={`mt-3 rounded border p-3 text-sm ${answers[current.id] === current.correctIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {answers[current.id] === current.correctIndex ? '✓ Chính xác!' : `✗ Chưa đúng — đáp án đúng: ${current.options[current.correctIndex]}`} — {current.explanation}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button disabled={picked === null} onClick={check}>Kiểm tra đáp án</Button>
                <Button variant="outline" disabled={idx >= set.questions.length - 1} onClick={() => { setIdx(idx + 1); setPicked(answers[set.questions[idx + 1]?.id] ?? null); }}>Câu tiếp →</Button>
                <Button variant="outline" onClick={submit}>Nộp bài</Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
