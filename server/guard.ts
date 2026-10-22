/**
 * Spend controls for the server-side model. These are inexpensive, per-process limits:
 * on Vercel each serverless instance keeps its own counters, so they are NOT a global cap.
 * The shared outer layer is a Vercel Firewall rate-limit rule plus a budget alert at the provider
 * (see README "Abuse protection"). The same-origin check stops other websites from spending the
 * key through their visitors' browsers; it is not authentication and does not stop scripts.
 */

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const LIMITS = {
  perIpWindowMs: 10 * 60_000,
  get perIpMax() { return num(process.env.RATE_PER_IP_10MIN, 6); },
  /** Counts upstream model attempts (a retry is a second call), per process per UTC day. */
  get dailyMax() { return num(process.env.DAILY_MODEL_CALLS, 400); },
  get maxConcurrent() { return Math.max(1, num(process.env.MAX_CONCURRENT_ANALYSES, 1)); },
};

const ipHits = new Map<string, number[]>();
let day = '';
let dayCount = 0;
let inFlight = 0;

/**
 * Client address for rate limiting. Forwarding headers are only trusted where a proxy we control sets them:
 * on Vercel (x-real-ip / x-vercel-forwarded-for, overwritten by the platform), or when TRUST_PROXY=1.
 * The local server passes the socket address in x-rakeless-peer and strips any client-sent copy.
 */
export function clientIp(req: Request, env = process.env) {
  const h = req.headers;
  if (env.VERCEL || env.TRUST_PROXY === '1') {
    const v = h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0];
    if (v) return v.trim();
  }
  return (h.get('x-rakeless-peer') || 'unknown').trim();
}

/** Only same-origin browser posts. Stops other sites from spending the key through visitors' browsers. Not authentication. */
export function sameOrigin(req: Request) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (!origin) return site === 'same-origin';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type Gate = { ok: true } | { ok: false; status: 409 | 429; message: string; retryAfter?: number };

function rollDay(now: number) {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
}

/** Check limits without consuming them. */
export function checkGate(ip: string, now = Date.now()): Gate {
  rollDay(now);
  if (dayCount >= LIMITS.dailyMax) return { ok: false, status: 429, message: 'Today’s shared analysis budget on this server is used up. The recorded example still works.', retryAfter: 3600 };
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < LIMITS.perIpWindowMs);
  if (hits.length) ipHits.set(ip, hits); else ipHits.delete(ip);
  if (hits.length >= LIMITS.perIpMax) {
    const retryAfter = Math.ceil((LIMITS.perIpWindowMs - (now - hits[0])) / 1000);
    return { ok: false, status: 429, message: `You have analyzed ${hits.length} photos in the last 10 minutes. Corrections are free; new photos can wait a few minutes.`, retryAfter };
  }
  if (inFlight >= LIMITS.maxConcurrent) return { ok: false, status: 409, message: 'Another photo is being read right now. Try again in a few seconds.' };
  return { ok: true };
}

/** One photo for this visitor's window. */
export function consumePhoto(ip: string, now = Date.now()) {
  ipHits.set(ip, [...(ipHits.get(ip) || []), now]);
}

/** One upstream model call against the daily budget. Returns false when the budget is spent. */
export function consumeAttempt(now = Date.now()) {
  rollDay(now);
  if (dayCount >= LIMITS.dailyMax) return false;
  dayCount++;
  return true;
}

export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
  }
}

export const _usage = () => ({ dayCount, inFlight });

export function _resetGuards() {
  ipHits.clear(); dayCount = 0; inFlight = 0;
}
