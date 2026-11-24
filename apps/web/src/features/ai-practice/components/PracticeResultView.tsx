import { TOPIC_LABELS, type SubmitPracticeAttemptResponse, type Topic } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface PracticeResultViewProps {
  result: SubmitPracticeAttemptResponse;
  onReset: () => void;
}

export function PracticeResultView({ result, onReset }: PracticeResultViewProps) {
  const { attempt, answers } = result;
  const durationSec = Math.max(1, Math.round(attempt.durationMs / 1000));

  return (
    <Card className="p-6" data-testid="practice-result-view">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Kết quả: {attempt.correctCount}/{attempt.totalQuestions} câu đúng ({attempt.score}%)
          </h3>
          <p className="text-xs text-slate-500">
            Thời gian làm bài: {durationSec} giây · Hồ sơ năng lực (SkillProfile) đã được cập nhật từ
            máy chủ.
          </p>
        </div>
        <Badge color={attempt.score >= 70 ? 'green' : 'amber'}>
          {attempt.score >= 70 ? 'Đạt yêu cầu' : 'Cần ôn tập thêm'}
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {answers.map((ans, i) => (
          <div key={ans.questionId} className="rounded border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                Câu {i + 1}: {ans.prompt}
              </p>
              <Badge color="slate">{TOPIC_LABELS[ans.topic as Topic] ?? ans.topic}</Badge>
            </div>
            {ans.code && (
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2.5 text-xs text-slate-100">
                {ans.code}
              </pre>
            )}
            <p
              className={`mt-2 text-sm font-medium ${
                ans.isCorrect ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {ans.isCorrect
                ? `✓ Đúng (${ans.options[ans.correctIndex] ?? ''})`
                : `✗ Sai — Bạn chọn: ${
                    ans.selectedIndex !== null ? ans.options[ans.selectedIndex] ?? 'Chưa chọn' : 'Chưa chọn'
                  } · Đáp án đúng: ${ans.options[ans.correctIndex] ?? ''}`}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Giải thích:</span> {ans.explanation}
            </p>
          </div>
        ))}
      </div>

      <Button className="mt-5" variant="outline" onClick={onReset}>
        Quay lại luyện bộ mới
      </Button>
    </Card>
  );
}
