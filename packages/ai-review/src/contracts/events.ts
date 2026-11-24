export type PlanCode = 'FREE' | 'PREMIUM';

export type TopicCode = 'CTDL' | 'OOP' | 'CSDL' | 'MANG' | 'HDH' | 'AI_DS' | 'WEB_CLOUD';

export interface AiReviewEventMap {
  'attempt.completed': {
    userId: string;
    attemptId: string;
    practiceSetId: string | null;
    topic: TopicCode | null;
    totalQuestions: number;
    correctCount: number;
    score: number;
    answeredAt: string;
  };
  'subscription.changed': {
    userId: string;
    oldPlan: PlanCode;
    newPlan: PlanCode;
    startedAt: string;
    at: string;
  };
  'user.deleted': {
    userId: string;
    at: string;
  };
  'ai_review.exam_set.created': {
    userId: string;
    examSetId: string;
    questionIds: string[];
    createdAt: string;
  };
}

export type AiReviewEventName = keyof AiReviewEventMap;

export type AiReviewEventListener<K extends AiReviewEventName> = (
  payload: AiReviewEventMap[K]
) => void | Promise<void>;

export interface EventBusPort {
  emit<K extends AiReviewEventName>(event: K, payload: AiReviewEventMap[K]): void;
  on<K extends AiReviewEventName>(event: K, listener: AiReviewEventListener<K>): () => void;
}
