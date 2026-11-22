import { useState } from 'react';
import type { MilestoneRemediation } from '@devstudy/shared';
import { Card, Button, Badge } from '../../../components/ui';

interface MilestoneRemediationCardProps {
  remediation: MilestoneRemediation;
  onComplete: () => Promise<void>;
  isCompleting: boolean;
}

export function MilestoneRemediationCard({
  remediation,
  onComplete,
  isCompleting,
}: MilestoneRemediationCardProps) {
  const [activeTab, setActiveTab] = useState<'lessons' | 'practice'>('lessons');
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});

  const handleSelectPractice = (qId: string, optIndex: number) => {
    setPracticeAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const handleCheckAnswer = (qId: string) => {
    setCheckedQuestions((prev) => ({ ...prev, [qId]: true }));
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40 p-4 sm:p-5 mt-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
            !
          </span>
          <h4 className="font-semibold text-amber-950 text-sm sm:text-base">
            Gói Bổ Trợ Thích Ứng (AI Remediation)
          </h4>
        </div>
        <Badge color="amber">Cần ôn tập</Badge>
      </div>

      {/* AI Weakness Analysis */}
      <div className="rounded-md bg-white p-3.5 border border-amber-200 text-xs leading-relaxed text-slate-700 space-y-1">
        <span className="font-semibold text-amber-900 block">
          💡 Phân tích từ AI Gemini 4 Hydrogen Medium:
        </span>
        <p>{remediation.weaknessAnalysis}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-amber-200">
        <button
          type="button"
          onClick={() => setActiveTab('lessons')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'lessons'
              ? 'border-amber-600 text-amber-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Bài học cần xem lại ({remediation.recommendedLessons.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('practice')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'practice'
              ? 'border-amber-600 text-amber-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Câu hỏi ôn tập phát sinh ({remediation.remedialQuestions.length})
        </button>
      </div>

      {/* Tab 1: Recommended Lessons */}
      {activeTab === 'lessons' && (
        <div className="space-y-2">
          {remediation.recommendedLessons.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-white p-3 border border-slate-200 text-xs"
            >
              <div>
                <span className="font-medium text-slate-900 block">{item.title}</span>
                <span className="text-slate-500 text-[11px]">{item.reason}</span>
              </div>
              <Button variant="outline" className="px-2.5 py-1 text-xs shrink-0 self-start sm:self-auto">
                Học lại bài này
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Remedial Questions */}
      {activeTab === 'practice' && (
        <div className="space-y-3">
          {remediation.remedialQuestions.map((q, idx) => {
            const isChecked = !!checkedQuestions[q.id];
            const selectedOpt = practiceAnswers[q.id];
            const isCorrect = isChecked && selectedOpt === q.correctIndex;

            return (
              <div key={q.id} className="rounded-md bg-white p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Câu hỏi bổ trợ {idx + 1}: {q.concept}
                  </span>
                  {isChecked && (
                    <Badge color={isCorrect ? 'green' : 'red'}>
                      {isCorrect ? 'Chính xác' : 'Chưa đúng'}
                    </Badge>
                  )}
                </div>
                <p className="text-slate-700 font-medium">{q.prompt}</p>

                <div className="space-y-1.5 pt-1">
                  {q.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={isChecked}
                      onClick={() => handleSelectPractice(q.id, oIdx)}
                      className={`w-full text-left p-2 rounded border transition-all text-xs flex items-center gap-2 ${
                        selectedOpt === oIdx
                          ? isChecked
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                              : 'border-red-500 bg-red-50 text-red-900'
                            : 'border-primary bg-blue-50 text-primary font-medium'
                          : isChecked && oIdx === q.correctIndex
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border flex items-center justify-center text-[10px]">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>

                {!isChecked ? (
                  <Button
                    variant="outline"
                    className="px-2.5 py-1 text-xs mt-1"
                    disabled={selectedOpt === undefined}
                    onClick={() => handleCheckAnswer(q.id)}
                  >
                    Kiểm tra đáp án
                  </Button>
                ) : (
                  <div className="mt-2 rounded bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200">
                    <span className="font-semibold block text-slate-800">Giải thích:</span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action to unlock milestone retry */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-200">
        <span className="text-[11px] text-slate-600">
          Sau khi đã xem lại kiến thức và hoàn thành câu hỏi ôn tập, bấm xác nhận để thi lại chặng này.
        </span>
        <Button
          className="px-3 py-1.5 text-xs w-full sm:w-auto shrink-0"
          disabled={isCompleting}
          onClick={onComplete}
        >
          {isCompleting ? 'Đang cập nhật…' : 'Đã hoàn thành ôn tập & Thi lại chặng'}
        </Button>
      </div>
    </Card>
  );
}
