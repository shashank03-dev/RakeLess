import { Context, type AnalyzeResponse } from '../shared/schema.js';
import { RULES_VERSION } from '../shared/rules.js';
import { normalizeImage, ImageError, MAX_UPLOAD_BYTES, MODEL_INPUT_CONFIG } from './image.js';
import { currentProvider, invalidateHealth, modelHealth, ModelError, observe, PROMPT_VERSION, TIMING } from './inference.js';
import { checkGate, clientIp, consumeAttempt, consumePhoto, sameOrigin, withSlot } from './guard.js';
import { CACHE, cacheKey, observationCache } from './cache.js';
import example from '../data/example-run.json' with { type: 'json' };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const fail = (status: number, message: string, headers?: Record<string, string>, extra: Record<string, unknown> = {}) => json(status, { error: message, ...extra }, headers);

/** Describes the selected provider, not just whether this web server is up. */
export async function health(): Promise<Response> {
  const p = currentProvider();
  const m = await modelHealth();
  return json(200, {
    app: { ready: true },
    model: {
      status: m.status,
      ready: m.status === 'ready',
      provider: p.id,
      providerLabel: p.label,
      local: p.local,
      destination: p.destination,
      name: p.modelName,
      version: m.modelVersion,
      detail: m.detail,
      reason: m.reason,
      checkedAtUtc: m.checkedAtUtc,
    },
    retention: {
      observationCacheTtlSeconds: Math.round(CACHE.ttlMs / 1000),
      storesImages: false,
    },
    timing: { requestBudgetMs: TIMING.requestBudgetMs },
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
  });
}

export async function analyze(req: Request): Promise<Response> {
  const t0 = Date.now();
  const deadline = t0 + TIMING.requestBudgetMs;
  if (req.method !== 'POST') return fail(405, 'Use POST.');
  if (!sameOrigin(req)) return fail(403, 'Analysis is only available from the RakeLess page.');
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, 'Image is larger than 8 MB.');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Send the photo as multipart form data.');
  }
  const files = form.getAll('image');
  if (files.length !== 1) return fail(400, 'Attach exactly one photo in the “image” field.');
  const file = files[0];
  if (!(file instanceof Blob) || file.size === 0) return fail(400, 'Attach one photo in the “image” field.');
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, 'Image is larger than 8 MB.');
  try {
    Context.parse(JSON.parse(String(form.get('context') ?? '')));
  } catch {
    return fail(400, 'The site context is missing or invalid.');
  }
  // Context is validated here; decisions are computed by the shared rules in the browser.

  let img;
  try {
    img = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof ImageError) return fail(e.status, e.message);
    return fail(400, 'That image could not be read.');
  }

  const p = currentProvider();
  const imageOut = { width: img.width, height: img.height, src: `data:image/jpeg;base64,${img.buffer.toString('base64')}` };
  const base = {
    provider: p.id,
    providerLabel: p.label,
    localInference: p.local,
    modelName: p.modelName,
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
    normalizedImageSha256: img.sha256,
  };

  const key = cacheKey({ imageSha256: img.sha256, provider: p.id, model: p.modelName, promptVersion: PROMPT_VERSION, inputConfig: MODEL_INPUT_CONFIG });
  const hit = observationCache.get(key);
  if (hit) {
    // The response is rebuilt from this request's own image; the cache only held labels.
    const body: AnalyzeResponse = {
      image: imageOut,
      observations: hit.observations,
      provenance: {
        ...base, mode: 'live', modelVersion: hit.modelVersion, timestampUtc: new Date().toISOString(),
        durationMs: hit.inferenceMs, requestMs: Date.now() - t0, attempts: 0, retryCount: 0, cacheHit: true,
        cachedAtUtc: new Date(hit.storedAt).toISOString(),
      },
    };
    return json(200, body);
  }

  const ip = clientIp(req);
  const gate = checkGate(ip);
  if (!gate.ok) return fail(gate.status, gate.message, gate.retryAfter ? { 'retry-after': String(gate.retryAfter) } : {});
  consumePhoto(ip);

  try {
    const out = await withSlot(() => observe(img, { deadline, signal: req.signal, beforeAttempt: () => consumeAttempt() }));
    observationCache.set(key, { observations: out.observations, modelVersion: out.modelVersion, inferenceMs: out.inferenceMs, attempts: out.attempts });
    const body: AnalyzeResponse = {
      image: imageOut,
      observations: out.observations,
      provenance: {
        ...base, mode: 'live', modelVersion: out.modelVersion, timestampUtc: new Date().toISOString(),
        durationMs: out.inferenceMs, requestMs: Date.now() - t0, attempts: out.attempts, retryCount: Math.max(0, out.attempts - 1), cacheHit: false,
      },
    };
    return json(200, body);
  } catch (e) {
    if (e instanceof ModelError) {
      if (e.status === 503) invalidateHealth();
      // Logged without image, prompt, evidence, or provider payload.
      console.warn(JSON.stringify({ event: 'analyze_failed', provider: p.id, status: e.status, attempts: e.attempts, ms: Date.now() - t0 }));
      return fail(e.status, e.message, e.status === 429 ? { 'retry-after': '600' } : {}, { attempts: e.attempts });
    }
    console.error(JSON.stringify({ event: 'analyze_error', provider: p.id, name: (e as Error).name }));
    return fail(500, 'Analysis failed unexpectedly.');
  }
}

const EXAMPLES: Record<string, unknown> = { 'fallen-leaves': example };

export function getExample(id: string): Response {
  if (!Object.hasOwn(EXAMPLES, id)) return fail(404, 'Unknown example.');
  return json(200, EXAMPLES[id], { 'cache-control': 'public, max-age=300' });
}
