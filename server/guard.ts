/**
 * Spend controls for the server-side model key. The key never leaves the server;
 * these limits bound how fast any one visitor (or the whole instance) can spend it.
 * State is per serverless instance — the edge rate-limit rule in vercel.json /
 * the Vercel firewall is the shared outer layer. See README "API key design".
 */
import type { AnalyzeResponse } from '../shared/schema.js';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const LIMITS = {
  perIpWindowMs: 10 * 60_000,
  perIpMax: num(process.env.RATE_PER_IP_10MIN, 6),
  dailyMax: num(process.env.DAILY_MODEL_CALLS, 400),
  cacheSize: 64,
};

const ipHits = new Map<string, number[]>();
let day = '';
let dayCount = 0;
let inFlight = false;
const cache = new Map<string, AnalyzeResponse>();

export function clientIp(req: Request) {
  return (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'local').trim();
}

/** Only same-origin browser posts. Stops other sites from spending the key through visitors' browsers. */
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

/** Check limits without consuming them. */
export function checkGate(ip: string, now = Date.now()): Gate {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= LIMITS.dailyMax) return { ok: false, status: 429, message: 'Today’s shared analysis budget is used up. The recorded example still works.', retryAfter: 3600 };
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < LIMITS.perIpWindowMs);
  ipHits.set(ip, hits);
  if (hits.length >= LIMITS.perIpMax) {
    const retryAfter = Math.ceil((LIMITS.perIpWindowMs - (now - hits[0])) / 1000);
    return { ok: false, status: 429, message: `You have analyzed ${hits.length} photos in the last 10 minutes. Corrections are free; new photos can wait a few minutes.`, retryAfter };
  }
  if (inFlight) return { ok: false, status: 409, message: 'Another photo is being read right now. Try again in a few seconds.' };
  return { ok: true };
}

export function consume(ip: string, now = Date.now()) {
  ipHits.set(ip, [...(ipHits.get(ip) || []), now]);
  dayCount++;
}

export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  inFlight = true;
  try {
    return await fn();
  } finally {
    inFlight = false;
  }
}

export const responseCache = {
  get: (k: string) => cache.get(k),
  set(k: string, v: AnalyzeResponse) {
    if (cache.size >= LIMITS.cacheSize) cache.delete(cache.keys().next().value!);
    cache.set(k, v);
  },
};

export function _resetGuards() {
  ipHits.clear(); cache.clear(); dayCount = 0; inFlight = false;
}
