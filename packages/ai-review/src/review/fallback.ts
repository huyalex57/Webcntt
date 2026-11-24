import type { TopicCode } from '../contracts/events.js';
import type { RecommendationSummary } from '../recommender/recommender.service.js';
import type { RoadmapTopicDto } from '../roadmap/roadmap.service.js';
import type {
  AiReviewSummaryOutputPayload,
  StudyPlanStepDto,
  WeaknessInsightDto,
} from './prompt-guard.js';

const TOPIC_LABELS_VI: Record<TopicCode, string> = {
  CTDL: 'Cấu trúc dữ liệu & Giải thuật',
  OOP: 'Lập trình Hướng đối tượng',
  CSDL: 'Cơ sở dữ liệu & SQL',
  MANG: 'Mạng máy tính',
  HDH: 'Hệ điều hành',
  AI_DS: 'Trí tuệ nhân tạo & Khoa học dữ liệu',
  WEB_CLOUD: 'Phát triển Web & Cloud',
};

/**
 * Pure deterministic rule-based Vietnamese AI Review Summary fallback.
 * Always produces a valid, grounded, zero-PII study plan with verified 0PL roadmap links
 * when the LLM provider fails, times out, returns invalid JSON, or fails output guardrails.
 */
export function buildDeterministicReviewSummary(params: {
  recommendations: RecommendationSummary;
  roadmaps: RoadmapTopicDto[];
  focusTopics?: TopicCode[];
}): AiReviewSummaryOutputPayload {
  const { recommendations, roadmaps, focusTopics } = params;

  const targetTopics: TopicCode[] =
    focusTopics && focusTopics.length > 0
      ? focusTopics
      : recommendations.weak_topics.length > 0
        ? recommendations.weak_topics
        : recommendations.recommended_next_topics;

  const primaryTopics = targetTopics.slice(0, 4);
  const masteryByTopic = new Map(recommendations.masteries.map((m) => [m.topic, m]));

  const weaknessInsights: WeaknessInsightDto[] = primaryTopics.map((topic) => {
    const m = masteryByTopic.get(topic);
    const label = TOPIC_LABELS_VI[topic] ?? topic;
    const pct = Math.round((m?.mastery ?? 0.5) * 100);
    const attempts = m?.answered ?? 0;

    const diagnosis =
      attempts === 0
        ? `Chủ đề ${label} (${topic}) chưa có dữ liệu luyện tập gần đây (mức khởi điểm ${pct}%).`
        : `Độ thành thạo ước lượng ở ${label} (${topic}) là ${pct}% sau ${attempts} lượt trả lời.`;

    const action_step =
      m?.isWeak || attempts === 0
        ? `Ôn lại khái niệm cốt lõi của ${label} và hoàn thành ít nhất 1 bộ đề 20 câu mức độ ${recommendations.recommended_difficulty}.`
        : `Duy trì phong độ ở ${label} bằng các câu hỏi nâng cao và rà soát câu từng sai.`;

    return {
      topic,
      diagnosis,
      action_step,
    };
  });

  const studyPlan: StudyPlanStepDto[] = [];

  if (recommendations.spaced_review_due_count > 0) {
    studyPlan.push({
      step: 1,
      title: `Ôn tập ngắt quãng ${recommendations.spaced_review_due_count} câu từng làm sai`,
      focus_topics: primaryTopics.slice(0, 3).length > 0 ? primaryTopics.slice(0, 3) : ['CTDL'],
      estimated_minutes: 30,
    });
  }

  for (const rm of roadmaps.slice(0, 3)) {
    if (studyPlan.length >= 4) break;
    const matchedTopics = rm.related_tags.filter((t): t is TopicCode =>
      Object.prototype.hasOwnProperty.call(TOPIC_LABELS_VI, t)
    );
    studyPlan.push({
      step: studyPlan.length + 1,
      title: `Tham khảo lộ trình: ${rm.title}`.slice(0, 140),
      focus_topics:
        matchedTopics.length > 0
          ? matchedTopics.slice(0, 3)
          : primaryTopics.slice(0, 2).length > 0
            ? primaryTopics.slice(0, 2)
            : ['CTDL'],
      roadmap_topic_id: rm.id,
      reference_url: rm.source_url,
      estimated_minutes: 45,
    });
  }

  const formatTopics = (codes: TopicCode[]) =>
    codes.map((c) => TOPIC_LABELS_VI[c] ?? c).join(', ');

  if (studyPlan.length === 0) {
    studyPlan.push({
      step: 1,
      title: `Luyện bộ đề 20 câu củng cố ${formatTopics(primaryTopics) || 'kiến thức nền tảng'}`.slice(
        0,
        140
      ),
      focus_topics: primaryTopics.length > 0 ? primaryTopics.slice(0, 3) : ['CTDL'],
      estimated_minutes: 40,
    });
  }

  const summary = recommendations.cold_start
    ? `Bạn mới bắt đầu luyện tập (${recommendations.total_answers_analyzed} câu đã trả lời). Nên khởi đầu bằng bộ đề 20 câu mức dễ ở các chủ đề ${formatTopics(primaryTopics)} để hệ thống đo chính xác điểm mạnh và điểm yếu.`
    : recommendations.weak_topics.length > 0
      ? `Dựa trên ${recommendations.total_answers_analyzed} lượt trả lời gần đây, các chủ đề cần ưu tiên củng cố là ${formatTopics(recommendations.weak_topics)}${
          recommendations.spaced_review_due_count > 0
            ? `, kết hợp ôn lại ${recommendations.spaced_review_due_count} câu từng làm sai`
            : ''
        }.`
      : `Kết quả luyện tập qua ${recommendations.total_answers_analyzed} lượt trả lời khá đồng đều. Gợi ý tiếp tục mở rộng độ khó ở ${formatTopics(primaryTopics)}.`;

  return {
    summary,
    weakness_insights: weaknessInsights,
    study_plan: studyPlan,
  };
}
