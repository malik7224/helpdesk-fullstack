import type { RequestHandler } from "express";

export interface RateLimitOptions {
  /** Requests allowed per window, per client IP. */
  max: number;
  windowMs: number;
}

/**
 * A small in-memory fixed-window limiter. Fine for one server process; behind
 * several instances use a shared store (for example Redis) instead.
 */
export function createRateLimiter({ max, windowMs }: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";

    let entry = windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
      }
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many attempts. Try again later." });
      return;
    }
    next();
  };
}
