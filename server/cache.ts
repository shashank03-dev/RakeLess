/**
 * Short-lived observation cache. It never holds image bytes or a full response: only the nine
 * observations (labels and short evidence text), the model version, and timing, keyed by a hash
 * that covers the image, provider, model, prompt, and model-input settings.
 * Per process: other serverless instances have their own (usually empty) cache.
 */
import type { Observation } from '../shared/schema.js';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const CACHE = {
  get ttlMs() { return num(process.env.OBSERVATION_CACHE_TTL_MS, 10 * 60_000); },
  get capacity() { return num(process.env.OBSERVATION_CACHE_SIZE, 32); },
};

export type CachedObservations = { observations: Observation[]; modelVersion: string | null; inferenceMs: number; attempts: number; storedAt: number };

const store = new Map<string, CachedObservations>();

export function cacheKey(parts: { imageSha256: string; provider: string; model: string; promptVersion: string; inputConfig: string }) {
  return [parts.imageSha256, parts.provider, parts.model, parts.promptVersion, parts.inputConfig].join('|');
}

function sweep(now: number) {
  for (const [k, v] of store) if (now - v.storedAt >= CACHE.ttlMs) store.delete(k);
}

export const observationCache = {
  get(key: string, now = Date.now()): CachedObservations | undefined {
    sweep(now);
    return store.get(key);
  },
  set(key: string, value: Omit<CachedObservations, 'storedAt'>, now = Date.now()) {
    if (CACHE.ttlMs === 0 || CACHE.capacity === 0) return;
    sweep(now);
    store.delete(key);
    while (store.size >= CACHE.capacity) store.delete(store.keys().next().value!);
    // Copy, so nothing that references request objects (or image buffers) is retained.
    store.set(key, { observations: value.observations.map((o) => ({ ...o })), modelVersion: value.modelVersion, inferenceMs: value.inferenceMs, attempts: value.attempts, storedAt: now });
  },
  size: () => store.size,
  /** Values only, for tests that assert no image data is retained. */
  _dump: () => [...store.values()],
  clear: () => store.clear(),
};
