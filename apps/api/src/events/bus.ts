import { EventEmitter } from 'node:events';
import type { PlanTier, ResourceTopic } from '@prisma/client';
import { logger } from '../config/logger.js';

export interface CoreEventMap {
  'attempt.completed': {
    userId: string;
    attemptId: string;
    practiceSetId: string | null;
    topic: ResourceTopic | null;
    totalQuestions: number;
    correctCount: number;
    score: number;
    answeredAt: string;
  };
  'subscription.changed': {
    userId: string;
    oldPlan: PlanTier;
    newPlan: PlanTier;
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

export type CoreEventName = keyof CoreEventMap;
export type CoreEventListener<K extends CoreEventName> = (
  payload: CoreEventMap[K]
) => void | Promise<void>;

export interface TypedEventBus {
  emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): void;
  on<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): () => void;
  once<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): () => void;
  off<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): void;
  removeAllListeners(event?: CoreEventName): void;
}

class InProcessEventBus implements TypedEventBus {
  private readonly emitter = new EventEmitter();
  private readonly wrappedListeners = new WeakMap<Function, (...args: any[]) => void>();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): () => void {
    const safeListener = this.wrap(event, listener);
    this.emitter.on(event, safeListener);
    return () => this.emitter.off(event, safeListener);
  }

  once<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): () => void {
    const safeListener = this.wrap(event, listener);
    this.emitter.once(event, safeListener);
    return () => this.emitter.off(event, safeListener);
  }

  off<K extends CoreEventName>(event: K, listener: CoreEventListener<K>): void {
    const wrapped = this.wrappedListeners.get(listener);
    if (wrapped) {
      this.emitter.off(event, wrapped);
    }
  }

  removeAllListeners(event?: CoreEventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  private wrap<K extends CoreEventName>(
    event: K,
    listener: CoreEventListener<K>
  ): (payload: CoreEventMap[K]) => void {
    const wrapped = (payload: CoreEventMap[K]) => {
      try {
        const result = listener(payload);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            logger.error({ err, event }, 'Async coreEventBus listener failed');
          });
        }
      } catch (err) {
        logger.error({ err, event }, 'Sync coreEventBus listener failed');
      }
    };
    this.wrappedListeners.set(listener, wrapped);
    return wrapped;
  }
}

export const coreEventBus: TypedEventBus = new InProcessEventBus();
