import { LEVEL_LABELS, TOPIC_LABELS, type PracticeSet } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface QuestionPlayerProps {
  set: PracticeSet;
  idx: number;
  picked: number | null;
  answers: Record<string, number>;
  onPick: (optionIndex: number) => void;
  onCheck: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function QuestionPlayer({
  set,
  idx,
  picked,
  answers,
  onPick,
  onCheck,
  onNext,
  onSubmit,
}: QuestionPlayerProps) {
  const current = set.questions[idx];
  if (!current) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <Badge color="navy">
          {TOPIC_LABELS[set.topic]} · {LEVEL_LABELS[set.level]}
        </Badge>
        <span className="text-sm text-slate-500">
          Câu hỏi {idx + 1} / {set.questions.length} · Độ khó: {current.difficulty}
        </span>
      </div>
      <p className="mt-3 font-medium leading-relaxed">{current.prompt}</p>
      {current.code && (
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {current.code}
        </pre>
      )}
      <div className="mt-4 space-y-2">
        {current.options.map((op, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`block w-full rounded border px-4 py-2.5 text-left text-sm ${
              picked === i
                ? 'border-primary bg-blue-50'
                : 'border-border-strong bg-white hover:bg-surface'
            }`}
          >
            <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {op}
          </button>
        ))}
      </div>
      {picked !== null && answers[current.id] !== undefined && (
        <div
          className={`mt-3 rounded border p-3 text-sm ${
            answers[current.id] === current.correctIndex
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {answers[current.id] === current.correctIndex
            ? '✓ Chính xác!'
            : `✗ Chưa đúng — đáp án đúng: ${current.options[current.correctIndex]}`}{' '}
          — {current.explanation}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button disabled={picked === null} onClick={onCheck}>
          Kiểm tra đáp án
        </Button>
        <Button
          variant="outline"
          disabled={idx >= set.questions.length - 1}
          onClick={onNext}
        >
          Câu tiếp →
        </Button>
        <Button variant="outline" onClick={onSubmit}>
          Nộp bài
        </Button>
      </div>
    </Card>
  );
}
