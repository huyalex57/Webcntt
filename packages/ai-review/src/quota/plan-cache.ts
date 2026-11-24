import type {
  PlanResolverPort,
  StudentPlanSubscription,
} from '../contracts/ports.js';

interface CacheEntry {
  value: StudentPlanSubscription;
  expiresAtMs: number;
}

export class PlanResolverCache {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly resolver: PlanResolverPort,
    private readonly ttlMs: number = 60_000,
    private readonly nowFn: () => Date = () => new Date()
  ) {}

  async getPlanSubscription(userId: string): Promise<StudentPlanSubscription> {
    const nowMs = this.nowFn().getTime();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAtMs > nowMs) {
      return cached.value;
    }

    const fresh = await this.resolver.getPlanSubscription(userId);
    this.cache.set(userId, {
      value: fresh,
      expiresAtMs: nowMs + this.ttlMs,
    });
    return fresh;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}
