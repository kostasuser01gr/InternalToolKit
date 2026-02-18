type BucketState = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, BucketState>();
const MAX_BUCKETS = 10_000;

function cleanupExpiredBuckets(nowMs: number) {
  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  for (const [key, state] of buckets.entries()) {
    if (state.resetAt <= nowMs) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const nowMs = options.nowMs ?? Date.now();
  cleanupExpiredBuckets(nowMs);

  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= nowMs) {
    buckets.set(options.key, {
      count: 1,
      resetAt: nowMs + options.windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - nowMs) / 1000),
      ),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSeconds: 0,
  };
}

