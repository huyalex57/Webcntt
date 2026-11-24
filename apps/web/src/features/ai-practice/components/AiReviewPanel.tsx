import { useState } from 'react';
import { TOPIC_LABELS, type Topic } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import type {
  AiReviewExamSetListItemDto,
  AiReviewRecommendationDto,
  AiReviewRoadmapTopicDto,
  AiReviewSummaryDto,
} from '../api/types';

export interface AiReviewPanelProps {
  recommendations: AiReviewRecommendationDto | undefined;
  isLoadingRecommendations: boolean;
  recentExamSets: AiReviewExamSetListItemDto[] | undefined;
  summary: AiReviewSummaryDto | null;
  isCreatingExamSet: boolean;
  isGeneratingSummary: boolean;
  isLoadingExamSetDetail: boolean;
  onCreatePersonalizedSet: (options: {
    goal: string;
    topics?: Topic[];
    roadmapTopicIds?: string[];
    useAi: boolean;
  }) => void;
  onGenerateSummary: (options: { goal?: string; topics?: Topic[] }) => void;
  onResumeExamSet: (examSetId: string) => void;
}

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

const DIFFICULTY_VI: Record<string, string> = {
  easy: 'Cơ bản',
  medium: 'Trung bình',
  hard: 'Nâng cao',
  adaptive: 'Thích ứng',
};

export function AiReviewPanel({
  recommendations,
  isLoadingRecommendations,
  recentExamSets,
  summary,
  isCreatingExamSet,
  isGeneratingSummary,
  isLoadingExamSetDetail,
  onCreatePersonalizedSet,
  onGenerateSummary,
  onResumeExamSet,
}: AiReviewPanelProps) {
  const [goal, setGoal] = useState('Ôn tập củng cố các chủ đề yếu (bộ 20 câu)');
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [useAi, setUseAi] = useState(true);

  const toggleTopic = (t: Topic) => {
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const weakTopics = recommendations?.weak_topics ?? [];
  const roadmaps: AiReviewRoadmapTopicDto[] =
    summary?.recommended_roadmaps?.length
      ? summary.recommended_roadmaps
      : recommendations?.recommended_roadmaps ?? [];

  return (
    <div className="space-y-4" data-testid="ai-review-panel">
      {/* 1. Primary Personalized 20-Q Generator Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-blue-50/60 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                AI Ôn tập &amp; Lộ trình cá nhân hóa
              </h3>
              <Badge color="navy">20 câu trắc nghiệm</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Tự động tổng hợp 60% chủ đề yếu, 25% câu từng làm sai (ôn ngắt quãng) và 15% mở rộng từ
              ngân hàng câu hỏi đã duyệt.
            </p>
          </div>
          {recommendations && (
            <Badge color={recommendations.spaced_review_due_count > 0 ? 'amber' : 'green'}>
              {recommendations.spaced_review_due_count > 0
                ? `${recommendations.spaced_review_due_count} câu đến hạn ôn lại`
                : `Độ khó gợi ý: ${DIFFICULTY_VI[recommendations.recommended_difficulty] ?? recommendations.recommended_difficulty}`}
            </Badge>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="ai-review-goal">
              Mục tiêu ôn tập
            </label>
            <Input
              id="ai-review-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={200}
              placeholder="Ví dụ: Ôn thi cuối kỳ CSDL và Hệ điều hành"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">
              Chọn chủ đề ưu tiên (để trống để AI tự chọn theo điểm yếu):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOPICS.map((t) => {
                const active = selectedTopics.includes(t);
                const isWeak = weakTopics.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTopic(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      active
                        ? 'border-primary bg-primary text-white'
                        : isWeak
                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          : 'border-border bg-white text-slate-700 hover:bg-surface'
                    }`}
                  >
                    {TOPIC_LABELS[t]}
                    {isWeak ? ' • yếu' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>Dùng AI sắp xếp bộ đề &amp; giải thích lý do chọn câu (tự động fallback nếu LLM lỗi)</span>
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              disabled={isCreatingExamSet || goal.trim().length < 3}
              onClick={() =>
                onCreatePersonalizedSet({
                  goal: goal.trim(),
                  topics: selectedTopics.length > 0 ? selectedTopics : undefined,
                  useAi,
                })
              }
            >
              {isCreatingExamSet
                ? 'Đang dựng bộ đề 20 câu…'
                : 'Tạo đề ôn tập cá nhân hóa (20 câu)'}
            </Button>

            <Button
              variant="outline"
              disabled={isGeneratingSummary}
              onClick={() =>
                onGenerateSummary({
                  goal: goal.trim().length >= 3 ? goal.trim() : undefined,
                  topics: selectedTopics.length > 0 ? selectedTopics : undefined,
                })
              }
            >
              {isGeneratingSummary ? 'AI đang phân tích…' : 'Phân tích AI & Kế hoạch ôn tập'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Weakness Analysis + Optional AI Summary Card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-slate-900">Phân tích điểm yếu &amp; Gợi ý ôn tập</h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Điểm thành thạo AI ưu tiên lịch sử trả lời gần đây (suy giảm theo thời gian &amp; tốc độ làm bài), có thể khác tỷ lệ tích luỹ tổng ở SkillProfile.
            </p>
          </div>
          {summary && (
            <Badge color={summary.source === 'llm' ? 'green' : 'amber'}>
              {summary.source === 'llm'
                ? `AI (${summary.model_id ?? 'LLM'})`
                : 'Chế độ dự phòng (Rule-based)'}
            </Badge>
          )}
        </div>

        {isLoadingRecommendations ? (
          <p className="mt-2 text-xs text-slate-500">Đang phân tích lịch sử làm bài…</p>
        ) : recommendations ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Đã phân tích: <strong>{recommendations.total_answers_analyzed}</strong> câu trả lời</span>
              <span>·</span>
              <span>
                Chủ đề cần củng cố:{' '}
                {weakTopics.length > 0 ? (
                  <strong className="text-amber-700">
                    {weakTopics.map((t) => TOPIC_LABELS[t]).join(', ')}
                  </strong>
                ) : (
                  <strong className="text-emerald-700">Chưa có điểm yếu nổi bật</strong>
                )}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {recommendations.masteries.slice(0, 4).map((m) => {
                const pct = Math.round(m.mastery * 100);
                return (
                  <div
                    key={m.topic}
                    className="rounded border border-border bg-surface/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{TOPIC_LABELS[m.topic]}</span>
                      <span className={m.isWeak ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                        {pct}% ({m.answered} câu)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full ${m.isWeak ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {summary && (
          <div className="mt-4 space-y-3 border-t border-border pt-4" data-testid="ai-summary-result">
            <p className="text-sm leading-relaxed text-slate-800">{summary.summary}</p>

            {summary.weakness_insights.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Chẩn đoán theo chủ đề
                </h5>
                {summary.weakness_insights.map((ins, i) => (
                  <div key={`${ins.topic}-${i}`} className="rounded border border-amber-200 bg-amber-50/50 p-3 text-xs">
                    <p className="font-semibold text-amber-900">{TOPIC_LABELS[ins.topic] ?? ins.topic}</p>
                    <p className="mt-0.5 text-slate-700">{ins.diagnosis}</p>
                    <p className="mt-1 text-slate-800">
                      <span className="font-medium">Hành động:</span> {ins.action_step}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {summary.study_plan.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kế hoạch ôn tập đề xuất
                </h5>
                <ol className="space-y-2">
                  {summary.study_plan.map((step) => (
                    <li
                      key={step.step}
                      className="rounded border border-border bg-white p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          Bước {step.step}: {step.title}
                        </span>
                        <span className="text-slate-500">~{step.estimated_minutes} phút</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {step.focus_topics.map((t) => (
                          <Badge key={t} color="navy">
                            {TOPIC_LABELS[t] ?? t}
                          </Badge>
                        ))}
                        {step.reference_url && (
                          <a
                            href={step.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline"
                          >
                            Xem lộ trình gốc ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3. Recommended Open-Source Roadmaps (awesome-roadmaps, 0PL-1.0) */}
      {roadmaps.length > 0 && (
        <Card className="p-5" data-testid="ai-roadmap-suggestions">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900">Lộ trình học tập gợi ý</h4>
            <span className="text-[11px] text-slate-500">
              {roadmaps[0].attribution}
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {roadmaps.slice(0, 4).map((rm) => (
              <div
                key={rm.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface/40 p-3 text-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={rm.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      {rm.title} ↗
                    </a>
                    {rm.year && <span className="shrink-0 text-[11px] text-slate-400">{rm.year}</span>}
                  </div>
                  {rm.summary && (
                    <p className="mt-1 line-clamp-2 text-slate-600">{rm.summary}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rm.related_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} color="slate">
                        {TOPIC_LABELS[tag as Topic] ?? tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    className="w-full px-2.5 py-1.5 text-xs"
                    disabled={isCreatingExamSet}
                    onClick={() =>
                      onCreatePersonalizedSet({
                        goal: `Ôn tập theo lộ trình ${rm.title}`.slice(0, 200),
                        roadmapTopicIds: [rm.id],
                        useAi,
                      })
                    }
                  >
                    Tạo đề 20 câu theo lộ trình này
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Recent Personalized Exam Sets */}
      {recentExamSets && recentExamSets.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-900">Bộ đề cá nhân hóa gần đây</h4>
          <div className="mt-2 divide-y divide-border">
            {recentExamSets.slice(0, 4).map((item) => (
              <div
                key={item.exam_set_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-slate-800">{item.goal}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.fulfilled} câu · nguồn: {item.source} ·{' '}
                    {new Date(item.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="px-2.5 py-1 text-xs"
                  disabled={isLoadingExamSetDetail}
                  onClick={() => onResumeExamSet(item.exam_set_id)}
                >
                  Làm bộ đề
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
