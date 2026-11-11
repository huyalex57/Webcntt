import { useState } from 'react';
import type { Level, PracticeSet, QuestionType, SkillProfile, Topic } from '@devstudy/shared';
import { useGeneratePracticeSet } from '../features/ai-practice/api';
import {
  PracticeConfigForm,
  PracticeResultView,
  QuestionPlayer,
  SkillProfileCard,
} from '../features/ai-practice/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { aiQuotaLimit } from '../lib/gating';
import { addDailyCount, getDailyCount, loadJSON, saveJSON } from '../lib/utils';
import { Card, PageHeader } from '../components/ui';

const DEFAULT_SKILLS: SkillProfile[] = [
  { topic: 'CTDL', accuracy: 86, answered: 42, weak: false },
  { topic: 'OOP', accuracy: 78, answered: 30, weak: false },
  { topic: 'CSDL', accuracy: 64, answered: 25, weak: true },
  { topic: 'MANG', accuracy: 71, answered: 18, weak: false },
  { topic: 'HDH', accuracy: 58, answered: 20, weak: true },
];

export default function PracticePage() {
  const { user } = useAuth();
  const toast = useToast();
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
  const [skills, setSkills] = useState<SkillProfile[]>(() =>
    loadJSON<SkillProfile[]>('skill-profile', DEFAULT_SKILLS)
  );

  const gen = useGeneratePracticeSet();
  const remaining = quotaLimit === Infinity ? Infinity : Math.max(0, quotaLimit - used);

  const generate = async () => {
    if (remaining < count) {
      toast.push(
        `Hết quota Free hôm nay (còn ${remaining} câu). Nâng cấp Premium để luyện không giới hạn.`,
        'error'
      );
      return;
    }
    const ps = await gen.mutateAsync({ topic, level, count, type: qtype });
    setUsed(addDailyCount('ai-used', ps.questions.length));
    setSet(ps);
    setIdx(0);
    setPicked(null);
    setAnswers({});
    setSubmitted(false);
  };

  const current = set?.questions[idx];

  const handleCheck = () => {
    if (picked === null || !current) return;
    setAnswers((a) => ({ ...a, [current.id]: picked }));
  };

  const handleSubmit = () => {
    if (!set) return;
    const correct = set.questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const score = Math.round((correct / set.questions.length) * 100);
    setSubmitted(true);
    const next = skills.map((s) =>
      s.topic === set.topic
        ? {
            ...s,
            answered: s.answered + set.questions.length,
            accuracy: Math.round(
              (s.accuracy * s.answered + score) / (s.answered + set.questions.length) || score
            ),
            weak: score < 70,
          }
        : s
    );
    setSkills(next);
    saveJSON('skill-profile', next);
    toast.push(`Đã nộp bài: ${correct}/${set.questions.length} đúng (${score}%) — SkillProfile đã cập nhật`);
  };

  return (
    <div>
      <PageHeader
        title="AI Luyện tập & Ôn thi cá nhân hoá"
        subtitle="Module luyện tập thích ứng — sinh câu hỏi theo chủ đề, trình độ và lịch sử trả lời sai của bạn (workflow §5.4)."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold">Tạo bộ câu hỏi mới</h3>
          <PracticeConfigForm
            topic={topic}
            level={level}
            count={count}
            qtype={qtype}
            used={used}
            quotaLimit={quotaLimit}
            isPending={gen.isPending}
            onTopicChange={setTopic}
            onLevelChange={setLevel}
            onCountChange={setCount}
            onQtypeChange={setQtype}
            onGenerate={generate}
          />
          <SkillProfileCard skills={skills} />
        </Card>

        <div className="lg:col-span-2">
          {!set ? (
            <Card className="p-6">
              <h3 className="font-semibold">Chưa có bộ câu hỏi</h3>
              <p className="mt-1 text-sm text-slate-600">
                Chọn chủ đề, trình độ và số câu rồi bấm “Tạo bộ câu hỏi”. Câu hỏi được sinh từ ngân hàng
                mẫu (bản thật gọi LLM qua AI service, validate Zod).
              </p>
            </Card>
          ) : submitted ? (
            <PracticeResultView set={set} answers={answers} onReset={() => setSet(null)} />
          ) : current ? (
            <QuestionPlayer
              set={set}
              idx={idx}
              picked={picked}
              answers={answers}
              onPick={setPicked}
              onCheck={handleCheck}
              onNext={() => {
                setIdx(idx + 1);
                setPicked(answers[set.questions[idx + 1]?.id] ?? null);
              }}
              onSubmit={handleSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
