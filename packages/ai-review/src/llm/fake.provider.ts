import {
  LLMProviderError,
  estimateTokenCount,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMProvider,
} from './types.js';

export type FakeProviderMode =
  | 'ok'
  | 'timeout'
  | 'upstream_error'
  | 'malformed_json'
  | 'hallucinated_ids';

export interface FakeProviderOptions {
  modelId?: string;
  mode?: FakeProviderMode;
  customResponder?: (request: LLMGenerateRequest) => Promise<string> | string;
}

const VALID_TOPICS = new Set(['CTDL', 'OOP', 'CSDL', 'MANG', 'HDH', 'AI_DS', 'WEB_CLOUD']);

const TOPIC_LABELS_VI: Record<string, string> = {
  CTDL: 'Cấu trúc dữ liệu & Giải thuật',
  OOP: 'Lập trình Hướng đối tượng',
  CSDL: 'Cơ sở dữ liệu & SQL',
  MANG: 'Mạng máy tính',
  HDH: 'Hệ điều hành',
  AI_DS: 'Trí tuệ nhân tạo & Khoa học dữ liệu',
  WEB_CLOUD: 'Phát triển Web & Cloud',
};

function formatTopicListVi(codes: string[]): string {
  return codes.map((c) => TOPIC_LABELS_VI[c] ?? c).join(', ');
}

function extractJsonBlock(prompt: string, label: string): unknown {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<data\\s+label="${escaped}"\\s+untrusted="true">\\s*([\\s\\S]*?)\\s*</data>`,
    'i'
  );
  const match = prompt.match(re);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1].replace(/<\\\/data/gi, '</data'));
  } catch {
    return null;
  }
}

/**
 * Deterministic offline LLMProvider for local development, CI, and automated tests.
 * Never makes external network requests.
 */
export class FakeProvider implements LLMProvider {
  readonly name = 'fake';
  readonly modelId: string;
  private readonly mode: FakeProviderMode;
  private readonly customResponder?: FakeProviderOptions['customResponder'];

  constructor(options: FakeProviderOptions = {}) {
    this.modelId = (options.modelId ?? 'fake-v1').trim() || 'fake-v1';
    this.mode = options.mode ?? 'ok';
    this.customResponder = options.customResponder;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startedAt = Date.now();
    const inputTokens = estimateTokenCount(`${request.systemInstruction}\n${request.userPrompt}`);

    if (this.customResponder) {
      const text = await this.customResponder(request);
      const outputTokens = estimateTokenCount(text);
      return {
        text,
        modelId: this.modelId,
        provider: this.name,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        latencyMs: Math.max(1, Date.now() - startedAt),
        finishReason: 'STOP',
      };
    }

    if (this.mode === 'timeout') {
      throw new LLMProviderError({
        message: 'FakeProvider simulated timeout',
        code: 'LLM_TIMEOUT',
        provider: this.name,
        retryable: true,
      });
    }

    if (this.mode === 'upstream_error') {
      throw new LLMProviderError({
        message: 'FakeProvider simulated 503 upstream failure',
        code: 'LLM_UPSTREAM_ERROR',
        provider: this.name,
        retryable: true,
        httpStatus: 503,
      });
    }

    if (this.mode === 'malformed_json') {
      const text = '{ invalid json response :::';
      const outputTokens = estimateTokenCount(text);
      return {
        text,
        modelId: this.modelId,
        provider: this.name,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        latencyMs: 2,
        finishReason: 'STOP',
      };
    }

    // Detect whether the prompt is asking for Exam-Set ranking or AI Review summary
    const candidatePayload = extractJsonBlock(request.userPrompt, 'candidate_questions') as
      | {
          requested?: number;
          candidates?: Array<{ id: string; topic: string; difficulty: string }>;
        }
      | null;

    let payloadObj: unknown;

    if (candidatePayload && Array.isArray(candidatePayload.candidates)) {
      const requested = Math.max(1, Number(candidatePayload.requested ?? 20));
      if (this.mode === 'hallucinated_ids') {
        payloadObj = {
          selected_question_ids: Array.from(
            { length: requested },
            (_, idx) => `q-hallucinated-${idx + 1}`
          ),
          rationale: 'Đề xuất giả lập để kiểm thử cơ chế lọc ID không tồn tại.',
        };
      } else {
        const picked = candidatePayload.candidates.slice(0, requested).map((c) => c.id);
        payloadObj = {
          selected_question_ids: picked,
          rationale: `Bộ ${picked.length} câu hỏi được sắp xếp ưu tiên theo chủ đề yếu và câu cần ôn tập ngắt quãng.`,
        };
      }
    } else {
      const profileData = extractJsonBlock(request.userPrompt, 'learner_analytics') as {
        weak_topics?: string[];
        recommended_next_topics?: string[];
        spaced_review_due_count?: number;
      } | null;
      const roadmapsData = extractJsonBlock(request.userPrompt, 'roadmap_references') as
        | Array<{ id: string; title: string; source_url: string; related_tags?: string[] }>
        | null;

      const weakTopics = (profileData?.weak_topics ?? []).filter((t) => VALID_TOPICS.has(t));
      const nextTopics = (profileData?.recommended_next_topics ?? ['CTDL', 'CSDL']).filter((t) =>
        VALID_TOPICS.has(t)
      );
      const focusList = weakTopics.length > 0 ? weakTopics : nextTopics.slice(0, 3);
      const safeRoadmaps = Array.isArray(roadmapsData) ? roadmapsData : [];

      const weaknessInsights = focusList.slice(0, 3).map((topic) => {
        const label = TOPIC_LABELS_VI[topic] ?? topic;
        return {
          topic,
          diagnosis: `Mức thành thạo ở chủ đề ${label} đang cần được củng cố dựa trên lịch sử trả lời gần đây.`,
          action_step: `Ôn lại kiến thức nền tảng ${label} và luyện tập bộ 20 câu mức độ thích ứng.`,
        };
      });

      const studyPlan =
        safeRoadmaps.length > 0
          ? safeRoadmaps.slice(0, 3).map((rm, idx) => ({
              step: idx + 1,
              title: `Ôn tập lộ trình: ${rm.title}`.slice(0, 120),
              focus_topics: (rm.related_tags ?? []).filter((t) => VALID_TOPICS.has(t)).slice(0, 3)
                .length
                ? (rm.related_tags ?? []).filter((t) => VALID_TOPICS.has(t)).slice(0, 3)
                : [focusList[0] ?? 'CTDL'],
              roadmap_topic_id: rm.id,
              reference_url: rm.source_url,
              estimated_minutes: 45,
            }))
          : [
              {
                step: 1,
                title: `Củng cố nền tảng ${formatTopicListVi(focusList) || 'CNTT'}`.slice(0, 140),
                focus_topics: focusList.length > 0 ? focusList.slice(0, 3) : ['CTDL'],
                estimated_minutes: 45,
              },
            ];

      payloadObj = {
        summary:
          weakTopics.length > 0
            ? `Phân tích học tập cho thấy bạn nên tập trung cải thiện ${formatTopicListVi(weakTopics)}${
                (profileData?.spaced_review_due_count ?? 0) > 0
                  ? ` và ôn lại ${profileData?.spaced_review_due_count} câu từng làm sai`
                  : ''
              }.`
            : `Hồ sơ học tập của bạn đang ở mức ổn định; hãy luyện bộ 20 câu mở rộng các chủ đề ${formatTopicListVi(nextTopics)}.`,
        weakness_insights: weaknessInsights,
        study_plan: studyPlan,
      };
    }

    const text = JSON.stringify(payloadObj);
    const outputTokens = estimateTokenCount(text);

    return {
      text,
      modelId: this.modelId,
      provider: this.name,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      latencyMs: Math.max(1, Date.now() - startedAt),
      finishReason: 'STOP',
    };
  }
}
