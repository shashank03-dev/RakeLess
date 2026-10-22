import type { Observation } from '../shared/schema.js';
import { annotateImage, cropCells, type NormalizedImage } from './image.js';
import { parseModelText } from './prompt.js';
import { geminiProvider } from './providers/gemini.js';
import { ollamaProvider } from './providers/ollama.js';
import { ProviderError, type ProviderId, type VisionProvider } from './providers/types.js';

export { parseModelText, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.js';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

/** Chosen once per process from server config. There is no automatic fallback to another provider. */
export function selectProvider(env = process.env): VisionProvider {
  const id = (env.RAKELESS_PROVIDER || 'gemini') as ProviderId;
  if (id === 'ollama') return ollamaProvider(env);
  return geminiProvider(env);
}

let provider = selectProvider();
export const currentProvider = () => provider;
/** Tests only. */
export function _setProvider(p: VisionProvider) { provider = p; healthCache = null; }

/**
 * Timing budget. One deadline covers image work, every upstream attempt, and serialization.
 * Defaults fit Vercel's 60 s function limit (vercel.json) with a reserve; local CPU inference needs a longer budget.
 */
export const TIMING = {
  get requestBudgetMs() { return num(process.env.REQUEST_BUDGET_MS, provider.id === 'ollama' ? 600_000 : 52_000); },
  get attemptCapMs() { return num(process.env.MODEL_TIMEOUT_MS, provider.id === 'ollama' ? 580_000 : 40_000); },
  get reserveMs() { return num(process.env.RESPONSE_RESERVE_MS, 2_500); },
  /** A retry is only started if at least this much time is left; otherwise it would just time out. */
  get minAttemptMs() { return num(process.env.MIN_ATTEMPT_MS, provider.id === 'ollama' ? 60_000 : 10_000); },
  maxAttempts: 2,
};

export class ModelError extends Error {
  constructor(message: string, public status: 502 | 503 | 504 | 429 | 499, public attempts = 0) {
    super(message);
  }
}

export type InferenceResult = {
  observations: Observation[];
  modelVersion: string | null;
  attempts: number;
  inferenceMs: number;
};

export type ObserveOptions = {
  deadline: number;
  signal?: AbortSignal;
  /** Called right before each upstream attempt; return false to stop (e.g. spend budget exhausted). */
  beforeAttempt?: (attempt: number) => boolean;
};

/**
 * Prepare the model input, then make at most two upstream attempts inside the request deadline.
 * Retries only schema failures and transient upstream errors, and only when enough time remains.
 */
export async function observe(img: NormalizedImage, opts: ObserveOptions): Promise<InferenceResult> {
  const p = provider;
  const cfg = p.configError();
  if (cfg) throw new ModelError('The model is not configured on this server.', 503);
  const [overview, crops] = await Promise.all([annotateImage(img), cropCells(img)]);

  const started = Date.now();
  let attempts = 0;
  let lastError = '';
  while (attempts < TIMING.maxAttempts) {
    const remaining = opts.deadline - TIMING.reserveMs - Date.now();
    if (attempts > 0 && remaining < TIMING.minAttemptMs) break;
    if (remaining <= 0) throw new ModelError('There was no time left to ask the model.', 504, attempts);
    if (opts.signal?.aborted) throw new ModelError('Cancelled.', 499, attempts);
    if (opts.beforeAttempt && !opts.beforeAttempt(attempts)) {
      if (attempts === 0) throw new ModelError('Today’s shared analysis budget is used up. The recorded example still works.', 429, 0);
      break;
    }
    const timeout = AbortSignal.timeout(Math.min(TIMING.attemptCapMs, remaining));
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    attempts++;
    try {
      const retryNote = lastError ? `Your previous answer was invalid (${lastError}). Return valid JSON matching the schema.` : undefined;
      const out = await p.attempt({ overview, crops, retryNote }, signal);
      const parsed = parseModelText(out.text);
      if (parsed.ok) return { observations: parsed.value.observations, modelVersion: out.modelVersion, attempts, inferenceMs: Date.now() - started };
      lastError = parsed.error;
    } catch (err) {
      if (opts.signal?.aborted) throw new ModelError('Cancelled.', 499, attempts);
      if (timeout.aborted) throw new ModelError('The model took too long to answer.', 504, attempts);
      if (err instanceof ProviderError) {
        if (err.kind === 'transient') { lastError = err.message; continue; }
        if (err.kind === 'quota') throw new ModelError(err.message, 429, attempts);
        if (err.kind === 'bad_request') throw new ModelError(err.message, 502, attempts);
        throw new ModelError(err.message, 503, attempts);
      }
      throw new ModelError('Could not reach the model service.', 502, attempts);
    }
  }
  throw new ModelError(
    attempts > 1 ? `The model did not return a valid answer in ${attempts} attempts (${lastError}).` : `The model did not return a valid answer, and there was not enough time to retry (${lastError}).`,
    502,
    attempts,
  );
}

export type Readiness = {
  status: 'ready' | 'unavailable' | 'config_error';
  reason: string | null;
  modelVersion: string | null;
  detail: string | null;
  checkedAtUtc: string;
};

let healthCache: { at: number; value: Readiness } | null = null;
let healthInFlight: Promise<Readiness> | null = null;

/**
 * Bounded, token-free probe of the selected provider. Ready results are cached 5 minutes;
 * failures only 15 seconds, so a transient outage recovers without a restart. Concurrent callers share one probe.
 */
export async function modelHealth(): Promise<Readiness> {
  const now = Date.now();
  if (healthCache) {
    const ttl = healthCache.value.status === 'ready' ? 300_000 : 15_000;
    if (now - healthCache.at < ttl) return healthCache.value;
  }
  if (healthInFlight) return healthInFlight;
  healthInFlight = (async () => {
    const r = await provider.health(AbortSignal.timeout(4_000)).catch(() => ({ status: 'unavailable' as const, reason: 'Readiness check failed.' }));
    const value: Readiness = r.status === 'ready'
      ? { status: 'ready', reason: null, modelVersion: r.modelVersion, detail: r.detail, checkedAtUtc: new Date().toISOString() }
      : { status: r.status, reason: r.reason, modelVersion: null, detail: null, checkedAtUtc: new Date().toISOString() };
    healthCache = { at: Date.now(), value };
    return value;
  })().finally(() => { healthInFlight = null; });
  return healthInFlight;
}

export function _resetHealth() { healthCache = null; healthInFlight = null; }

/** After a live failure that suggests the provider is down, forget a cached "ready". */
export function invalidateHealth() { healthCache = null; }
