/**
 * Minimal fixed-window rate limiting backed by Postgres — no extra
 * infrastructure. Sized for ~1k users: the goal is stopping one hostile
 * client from burning AI spend / render CPU / DB rows, not precise
 * throttling. One indexed upsert per limited request.
 *
 * Buckets key on the client IP (first hop of x-forwarded-for, set by the
 * platform), so clearing cookies doesn't reset an abuser's budget. Checks
 * FAIL OPEN on DB errors: an outage degrades like the rest of the app
 * instead of locking everyone out.
 */

import { prisma } from "@/lib/db";

export interface RateLimitRule {
  /** Bucket namespace, e.g. "teams-post". */
  scope: string;
  /** Max requests per window (the limit-th request still passes). */
  limit: number;
  windowSeconds: number;
}

/**
 * All limits in one place. Per-IP unless noted. Generous for a human on one
 * device; far below what a script needs to do damage.
 */
export const RATE_LIMITS = {
  /** Explain requests (cache hits included) — each sim/team view sends one. */
  explain: { scope: "explain", limit: 30, windowSeconds: 600 },
  /**
   * GLOBAL daily cap on uncached Claude generations — the app-level spend
   * ceiling. At Haiku explain sizes this bounds worst-case model spend to a
   * few dollars/day; bump alongside the Anthropic console spend limit.
   */
  explainGenerationDaily: {
    scope: "explain-gen",
    limit: 2000,
    windowSeconds: 86_400,
  },
  /** Satori card renders are CPU-heavy; unique payloads bypass CDN cache. */
  cardRender: { scope: "card", limit: 30, windowSeconds: 300 },
  teamSave: { scope: "teams-post", limit: 20, windowSeconds: 600 },
  teamClaim: { scope: "team-claim", limit: 10, windowSeconds: 600 },
  matchupRun: { scope: "matchups-post", limit: 20, windowSeconds: 600 },
  lobbyCreate: { scope: "lobby-create", limit: 10, windowSeconds: 3600 },
  lobbyEnter: { scope: "lobby-enter", limit: 20, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>;

/** Identity a caller for bucketing. Falls back to one shared bucket when the
 *  proxy header is absent (local dev) — still a cap, just a coarse one. */
export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

/** Stale-bucket pruning piggybacks on ~2% of checks (no cron needed). */
const PRUNE_PROBABILITY = 0.02;
const PRUNE_OLDER_THAN_MS = 48 * 60 * 60 * 1000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (0 when ok). */
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  rule: RateLimitRule,
  id: string
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));
  const key = `${rule.scope}:${id}`;

  try {
    // Native INSERT ... ON CONFLICT (all unique fields in `where`), so
    // concurrent requests increment atomically.
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart },
      update: { count: { increment: 1 } },
    });

    if (Math.random() < PRUNE_PROBABILITY) {
      void prisma.rateLimitBucket
        .deleteMany({
          where: { windowStart: { lt: new Date(now - PRUNE_OLDER_THAN_MS) } },
        })
        .catch(() => {});
    }

    if (bucket.count > rule.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((windowStart.getTime() + windowMs - now) / 1000)
        ),
      };
    }
    return { ok: true, retryAfterSeconds: 0 };
  } catch {
    // Fail open: rate limiting is protection, not a dependency.
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/**
 * Per-IP gate for a route handler: returns a 429 Response to send back, or
 * null to proceed.
 */
export async function rateLimitGate(
  request: Request,
  rule: RateLimitRule
): Promise<Response | null> {
  const result = await checkRateLimit(rule, clientKey(request));
  if (result.ok) return null;
  return Response.json(
    { error: "Too many requests — give it a minute and try again." },
    {
      status: 429,
      headers: { "retry-after": String(result.retryAfterSeconds) },
    }
  );
}
