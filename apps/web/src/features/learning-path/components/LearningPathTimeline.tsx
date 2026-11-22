import { useState } from 'react';
import type { LearningPath, Milestone } from '@devstudy/shared';
import { Card, Button, Badge } from '../../../components/ui';
import { MilestoneQuizModal } from './MilestoneQuizModal';
import { MilestoneRemediationCard } from './MilestoneRemediationCard';
import { useEvaluateMilestone, useCompleteRemediation } from '../api';
import { useToast } from '../../../lib/toast';

interface LearningPathTimelineProps {
  path: LearningPath;
  courseId: string;
}

export function LearningPathTimeline({ path, courseId }: LearningPathTimelineProps) {
  const toast = useToast();
  const [selectedMilestoneForQuiz, setSelectedMilestoneForQuiz] = useState<Milestone | null>(null);

  const evaluateMutation = useEvaluateMilestone(courseId);
  const completeRemediationMutation = useCompleteRemediation(courseId);

  const handleStartQuiz = (milestone: Milestone) => {
    setSelectedMilestoneForQuiz(milestone);
  };

  const handleSubmitQuiz = async (answers: Record<string, number>) => {
    if (!selectedMilestoneForQuiz) return;
    try {
      const res = await evaluateMutation.mutateAsync({
        milestoneId: selectedMilestoneForQuiz.id,
        answers,
      });

      if (res.passed) {
        toast.push(res.feedback, 'success');
      } else {
        toast.push(res.feedback, 'warning');
      }
    } catch (err: any) {
      toast.push(err.message || 'Lỗi khi gửi bài kiểm tra', 'error');
    }
  };

  const handleCompleteRemediation = async (remediationId: string) => {
    try {
      await completeRemediationMutation.mutateAsync(remediationId);
      toast.push('Đã hoàn thành gói bổ trợ! Chặng học tập đã sẵn sàng để thi lại.', 'success');
    } catch (err: any) {
      toast.push(err.message || 'Lỗi khi cập nhật trạng thái ôn tập', 'error');
    }
  };

  const getStatusBadge = (status: Milestone['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge color="green">Đã hoàn thành</Badge>;
      case 'IN_PROGRESS':
        return <Badge color="blue">Đang thực hiện</Badge>;
      case 'NEEDS_REVIEW':
        return <Badge color="amber">Cần bổ trợ & ôn tập</Badge>;
      case 'LOCKED':
      default:
        return <Badge color="slate">Chưa mở khoá</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="p-5 border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Lộ Trình Thích Ứng AI
              </span>
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                {path.modelName}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">Mục tiêu: {path.targetGoal}</h3>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-black text-primary">{path.progressPercent}%</span>
            <span className="text-xs text-slate-500 block">Tiến độ chặng</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600 bg-white/70 p-3 rounded border border-blue-100">
          <strong>Lời khuyên từ AI:</strong> {path.aiSummary}
        </p>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${path.progressPercent}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Stepper Milestones Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {path.milestones.map((m, idx) => {
          const isLocked = m.status === 'LOCKED';
          const isInProgress = m.status === 'IN_PROGRESS';
          const isNeedsReview = m.status === 'NEEDS_REVIEW';
          const isCompleted = m.status === 'COMPLETED';

          return (
            <div key={m.id} className="relative">
              {/* Step Marker Circle */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isCompleted
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                    : isNeedsReview
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                    : isInProgress
                    ? 'bg-primary text-white ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>

              {/* Milestone Box */}
              <Card
                className={`p-4 sm:p-5 transition-all ${
                  isInProgress
                    ? 'border-primary shadow-sm'
                    : isNeedsReview
                    ? 'border-amber-400'
                    : isLocked
                    ? 'opacity-70 bg-slate-50/50'
                    : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      {m.title}
                    </h4>
                  </div>
                  <div>{getStatusBadge(m.status)}</div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-1">{m.description}</p>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>⏱ Thời lượng ước tính: ~{m.estimatedHours} giờ</span>
                  <span>📚 {m.lessonIds.length} bài học gắn kèm</span>
                  <span>🎯 Ngưỡng qua chặng: {m.passingScore}% điểm quiz</span>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {isInProgress && (
                    <Button className="px-3 py-1.5 text-xs" onClick={() => handleStartQuiz(m)}>
                      Làm bài kiểm tra xét duyệt chặng ({m.quizQuestions.length} câu)
                    </Button>
                  )}

                  {isNeedsReview && (
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
                      onClick={() => handleStartQuiz(m)}
                    >
                      Thi lại bài kiểm tra chặng
                    </Button>
                  )}

                  {isCompleted && (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <span>✓</span> Bạn đã vượt qua chặng này thành công
                    </span>
                  )}

                  {isLocked && (
                    <span className="text-xs text-slate-400 italic">
                      Hoàn thành chặng trước để mở khoá chặng này
                    </span>
                  )}
                </div>

                {/* Adaptive Remediation Box if Failed */}
                {isNeedsReview && m.remediation && (
                  <MilestoneRemediationCard
                    remediation={m.remediation}
                    onComplete={() => handleCompleteRemediation(m.remediation!.id)}
                    isCompleting={completeRemediationMutation.isPending}
                  />
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Quiz Modal */}
      {selectedMilestoneForQuiz && (
        <MilestoneQuizModal
          open={!!selectedMilestoneForQuiz}
          onClose={() => setSelectedMilestoneForQuiz(null)}
          milestone={selectedMilestoneForQuiz}
          onSubmitAnswers={handleSubmitQuiz}
          isSubmitting={evaluateMutation.isPending}
        />
      )}
    </div>
  );
}
