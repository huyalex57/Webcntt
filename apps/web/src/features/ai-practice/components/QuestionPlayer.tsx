import { LEVEL_LABELS, TOPIC_LABELS } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import type { ActivePracticeSession } from '../api/types';

export interface QuestionPlayerProps {
  session: ActivePracticeSession;
  idx: number;
  answers: Record<string, number>;
  isSubmitting?: boolean;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  onJump: (index: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const SOURCE_BADGES: Record<ActivePracticeSession['source'], { label: string; color: 'navy' | 'green' | 'amber' | 'slate' }> = {
  llm: { label: 'Đề AI cá nhân hóa', color: 'green' },
  hybrid: { label: 'Đề AI + Rule-based', color: 'navy' },
  rule_based: { label: 'Đề cá nhân hóa (Rule-based)', color: 'amber' },
  practice_bank: { label: 'Ngân hàng câu hỏi', color: 'slate' },
  mock: { label: 'Chế độ mô phỏng', color: 'slate' },
};

const REASON_LABELS: Record<string, { label: string; color: 'navy' | 'green' | 'amber' | 'slate' }> = {
  SPACED_REVIEW: { label: 'Ôn ngắt quãng · câu từng sai', color: 'amber' },
  WEAK_TOPIC: { label: 'Củng cố chủ đề yếu', color: 'amber' },
  USER_TOPIC: { label: 'Theo chủ đề / lộ trình đã chọn', color: 'navy' },
  EXPLORATION: { label: 'Mở rộng kiến thức', color: 'slate' },
  LLM_PROPOSED: { label: 'AI ưu tiên đề xuất', color: 'green' },
};

function formatWarningMessage(code: string, actualCount: number): string {
  switch (code) {
    case 'INSUFFICIENT_POOL':
      return `Ngân hàng câu hỏi phù hợp hiện có ${actualCount} câu (ít hơn mục tiêu ban đầu do giới hạn chủ đề hoặc đã loại các câu bạn vừa làm gần đây).`;
    case 'LLM_FALLBACK_ACTIVATED':
      return 'Hệ thống AI tạm thời không khả dụng — bộ đề đã được dựng tự động bằng thuật toán rule-based.';
    case 'LLM_OUTPUT_GUARD_FALLBACK':
      return 'Phản hồi từ mô hình AI không đạt chuẩn an toàn — bộ đề đã tự động chuyển sang chế độ rule-based.';
    case 'PROPOSED_IDS_BELOW_THRESHOLD_FALLBACK':
      return 'Một số gợi ý từ AI không nằm trong ngân hàng đã duyệt — hệ thống đã chuyển sang chọn đề chuẩn hoá.';
    case 'LLM_TOKEN_QUOTA_EXCEEDED_FALLBACK':
      return 'Hạn mức token AI chu kỳ này đã hết — bộ đề vẫn được tạo bằng thuật toán rule-based miễn phí.';
    default:
      return code;
  }
}

export function QuestionPlayer({
  session,
  idx,
  answers,
  isSubmitting = false,
  onSelectAnswer,
  onJump,
  onSubmit,
  onCancel,
}: QuestionPlayerProps) {
  const current = session.questions[idx];
  if (!current) return null;

  const selected = answers[current.id] ?? null;
  const answeredCount = session.questions.filter((q) => answers[q.id] !== undefined).length;
  const badge = SOURCE_BADGES[session.source];
  const reasonInfo = current.reason ? REASON_LABELS[current.reason] : undefined;
  const hasClientAnswerKey = typeof current.correctIndex === 'number';
  const warnings = session.warnings?.filter(Boolean) ?? [];

  return (
    <Card className="p-6" data-testid="question-player">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={badge.color}>{badge.label}</Badge>
          <Badge color="navy">
            {TOPIC_LABELS[current.topic] ?? current.topic} · {LEVEL_LABELS[current.level] ?? current.level}
          </Badge>
          {reasonInfo && (
            <span data-testid="question-reason-badge">
              <Badge color={reasonInfo.color}>{reasonInfo.label}</Badge>
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          Câu {idx + 1} / {session.questions.length} · Đã chọn {answeredCount}/{session.questions.length} · Độ khó: {current.difficulty}
        </span>
      </div>

      {session.rationale && (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
          <span className="font-semibold">Lý do đề xuất:</span> {session.rationale}
        </div>
      )}

      {warnings.length > 0 && (
        <div
          className="mt-3 space-y-1 rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
          data-testid="session-warnings"
          role="status"
        >
          {warnings.map((w, i) => (
            <p key={`${w}-${i}`}>
              <span className="font-semibold">Lưu ý:</span>{' '}
              {formatWarningMessage(w, session.questions.length)}
            </p>
          ))}
        </div>
      )}

      {/* Question navigator pills for quick jump across 20-question sets */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {session.questions.map((q, qIdx) => {
          const isCurrent = qIdx === idx;
          const isAnswered = answers[q.id] !== undefined;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(qIdx)}
              aria-label={`Chuyển đến câu ${qIdx + 1}`}
              className={`h-7 w-7 rounded text-xs font-medium transition ${
                isCurrent
                  ? 'bg-primary text-white ring-2 ring-primary/30'
                  : isAnswered
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'border border-border bg-white text-slate-600 hover:bg-surface'
              }`}
            >
              {qIdx + 1}
            </button>
          );
        })}
      </div>

      <p className="mt-4 font-medium leading-relaxed text-slate-900">{current.prompt}</p>
      {current.code && (
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {current.code}
        </pre>
      )}

      <div className="mt-4 space-y-2">
        {current.options.map((op, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectAnswer(current.id, i)}
            className={`block w-full rounded border px-4 py-2.5 text-left text-sm transition ${
              selected === i
                ? 'border-primary bg-blue-50 font-medium text-slate-900'
                : 'border-border-strong bg-white text-slate-800 hover:bg-surface'
            }`}
          >
            <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {op}
          </button>
        ))}
      </div>

      {hasClientAnswerKey && selected !== null && (
        <div
          className={`mt-3 rounded border p-3 text-sm ${
            selected === current.correctIndex
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {selected === current.correctIndex
            ? '✓ Chính xác!'
            : `✗ Chưa đúng — đáp án đúng: ${current.options[current.correctIndex!]}`}{' '}
          {current.explanation ? `— ${current.explanation}` : ''}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={idx === 0}
            onClick={() => onJump(idx - 1)}
          >
            ← Câu trước
          </Button>
          <Button
            variant="outline"
            disabled={idx >= session.questions.length - 1}
            onClick={() => onJump(idx + 1)}
          >
            Câu tiếp →
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={isSubmitting} onClick={onCancel}>
            Thoát
          </Button>
          <Button disabled={isSubmitting || answeredCount === 0} onClick={onSubmit}>
            {isSubmitting ? 'Đang chấm điểm…' : `Nộp bài (${answeredCount}/${session.questions.length})`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
