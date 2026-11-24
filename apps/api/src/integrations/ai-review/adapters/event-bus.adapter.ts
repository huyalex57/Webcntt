import type {
  AiReviewEventListener,
  AiReviewEventMap,
  AiReviewEventName,
  EventBusPort,
} from '@devstudy/ai-review/contracts';
import { coreEventBus } from '../../../events/bus.js';

export function createEventBusAdapter(): EventBusPort {
  return {
    emit<K extends AiReviewEventName>(event: K, payload: AiReviewEventMap[K]): void {
      coreEventBus.emit(event, payload as any);
    },
    on<K extends AiReviewEventName>(
      event: K,
      listener: AiReviewEventListener<K>
    ): () => void {
      return coreEventBus.on(event, listener as any);
    },
  };
}
