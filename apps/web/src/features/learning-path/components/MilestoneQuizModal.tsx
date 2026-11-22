import { useState } from 'react';
import type { Milestone, MilestoneQuizQuestion } from '@devstudy/shared';
import { Modal, Button } from '../../../components/ui';

interface MilestoneQuizModalProps {
  open: boolean;
  onClose: () => void;
  milestone: Milestone;
  onSubmitAnswers: (answers: Record<string, number>) => Promise<void>;
  isSubmitting: boolean;
}

export function MilestoneQuizModal({
  open,
  onClose,
  milestone,
  onSubmitAnswers,
  isSubmitting,
}: MilestoneQuizModalProps) {
  const questions: MilestoneQuizQuestion[] = milestone.quizQuestions || [];
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQ = questions[currentIndex];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const handleSelectOption = (qId: string, optIndex: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const handleFinish = async () => {
    await onSubmitAnswers(answers);
    onClose();
  };

  if (!open || questions.length === 0) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Bài kiểm tra xét duyệt: ${milestone.title}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b">
          <span>
            Câu hỏi <strong>{currentIndex + 1}</strong> / {questions.length}
          </span>
          <span>
            Ngưỡng đạt yêu cầu: <strong>{milestone.passingScore}%</strong>
          </span>
        </div>

        {currentQ && (
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900 text-sm">{currentQ.prompt}</h4>

            {currentQ.code && (
              <pre className="rounded bg-slate-900 p-3 font-mono text-xs text-slate-100 overflow-x-auto">
                <code>{currentQ.code}</code>
              </pre>
            )}

            <div className="space-y-2 pt-1">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = answers[currentQ.id] === oIdx;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, oIdx)}
                    className={`w-full text-left p-3 rounded-md border text-xs sm:text-sm transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-primary bg-blue-50 text-primary font-medium ring-1 ring-primary'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs">
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question navigator */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-1.5">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-7 w-7 rounded text-xs font-medium ${
                  idx === currentIndex
                    ? 'bg-primary text-white'
                    : answers[q.id] !== undefined
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {currentIndex > 0 && (
              <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => setCurrentIndex(currentIndex - 1)}>
                Câu trước
              </Button>
            )}
            {currentIndex < questions.length - 1 ? (
              <Button className="px-2 py-1 text-xs" onClick={() => setCurrentIndex(currentIndex + 1)}>
                Câu tiếp theo
              </Button>
            ) : (
              <Button
                className="px-3 py-1 text-xs"
                disabled={!allAnswered || isSubmitting}
                onClick={handleFinish}
              >
                {isSubmitting ? 'AI đang chấm…' : 'Nộp bài xét duyệt'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
