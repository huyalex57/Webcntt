import type { PracticeSet } from '@devstudy/shared';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface PracticeResultViewProps {
  set: PracticeSet;
  answers: Record<string, number>;
  onReset: () => void;
}

export function PracticeResultView({ set, answers, onReset }: PracticeResultViewProps) {
  const correctCount = set.questions.filter((q) => answers[q.id] === q.correctIndex).length;
  const percentage = Math.round((correctCount / set.questions.length) * 100);

  return (
    <Card className="p-6">
      <h3 className="font-semibold">
        Kết quả: {correctCount}/{set.questions.length} đúng ({percentage}%)
      </h3>
      <div className="mt-4 space-y-4">
        {set.questions.map((q, i) => (
          <div key={q.id} className="rounded border border-border p-4">
            <p className="text-sm font-medium">
              Câu {i + 1}: {q.prompt}
            </p>
            <p
              className={`mt-1 text-sm ${
                answers[q.id] === q.correctIndex ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {answers[q.id] === q.correctIndex
                ? '✓ Đúng'
                : `✗ Sai — đáp án đúng: ${q.options[q.correctIndex]}`}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium">Giải thích AI Mentor:</span> {q.explanation}
            </p>
          </div>
        ))}
      </div>
      <Button className="mt-4" variant="outline" onClick={onReset}>
        Luyện bộ mới
      </Button>
    </Card>
  );
}
