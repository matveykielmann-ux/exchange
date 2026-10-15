/**
 * Fixed-window rate limiter held in memory. Correct for the single-process
 * deployment this server is designed for; a multi-instance deployment needs a
 * shared store (see README_DEPLOY.md).
 */
export interface RateLimiter {
  take(key: string, max: number, windowMs: number): boolean;
  reset(): void;
}

export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  let lastSweep = now();
  return {
    take(key, max, windowMs) {
      const t = now();
      if (t - lastSweep > 60_000) {
        for (const [k, w] of windows) if (t - w.start > 3_600_000) windows.delete(k);
        lastSweep = t;
      }
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count++;
      return w.count <= max;
    },
    reset() {
      windows.clear();
    },
  };
}
