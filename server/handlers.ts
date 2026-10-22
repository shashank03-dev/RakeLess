import { Context, type AnalyzeResponse } from '../shared/schema';
import { RULES_VERSION } from '../shared/rules';
import { normalizeImage, ImageError, MAX_UPLOAD_BYTES } from './image';
import { observe, modelHealth, ModelError, MODEL_NAME, PROMPT_VERSION } from './inference';
import { checkGate, clientIp, consume, responseCache, sameOrigin, withSlot } from './guard';
import example from '../data/example-run.json' with { type: 'json' };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const fail = (status: number, message: string, headers?: Record<string, string>) => json(status, { error: message }, headers);

export async function health(): Promise<Response> {
  const m = await modelHealth();
  return json(200, {
    app: { ready: true },
    model: { ready: m.ok, provider: 'Google Gemini API (hosted Gemma open weights)', name: MODEL_NAME, reason: m.reason },
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
  });
}

export async function analyze(req: Request): Promise<Response> {
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
  const file = form.get('image');
  if (!(file instanceof Blob) || file.size === 0) return fail(400, 'Attach one photo in the “image” field.');
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, 'Image is larger than 8 MB.');
  let ctx;
  try {
    ctx = Context.parse(JSON.parse(String(form.get('context') ?? '')));
  } catch {
    return fail(400, 'The site context is missing or invalid.');
  }
  void ctx; // Context is validated here; decisions are computed by the shared rules on the client.

  let img;
  try {
    img = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof ImageError) return fail(e.status, e.message);
    return fail(400, 'That image could not be read.');
  }

  const cacheKey = [img.sha256, MODEL_NAME, PROMPT_VERSION].join(':');
  const hit = responseCache.get(cacheKey);
  if (hit) return json(200, { ...hit, provenance: { ...hit.provenance, cacheHit: true } });

  const ip = clientIp(req);
  const gate = checkGate(ip);
  if (!gate.ok) return fail(gate.status, gate.message, gate.retryAfter ? { 'retry-after': String(gate.retryAfter) } : {});
  consume(ip);

  try {
    const out = await withSlot(() => observe(img));
    const body: AnalyzeResponse = {
      image: { width: img.width, height: img.height, src: `data:image/jpeg;base64,${img.buffer.toString('base64')}` },
      observations: out.observations,
      provenance: {
        mode: 'live',
        provider: 'Google Gemini API',
        modelName: MODEL_NAME,
        modelVersion: out.modelVersion,
        promptVersion: PROMPT_VERSION,
        rulesVersion: RULES_VERSION,
        normalizedImageSha256: img.sha256,
        timestampUtc: new Date().toISOString(),
        durationMs: out.durationMs,
        retryCount: out.retryCount,
        cacheHit: false,
      },
    };
    responseCache.set(cacheKey, body);
    return json(200, body);
  } catch (e) {
    if (e instanceof ModelError) return fail(e.status, e.message);
    console.error('analyze failed', (e as Error).name);
    return fail(500, 'Analysis failed unexpectedly.');
  }
}

const EXAMPLES: Record<string, unknown> = { 'fallen-leaves': example };

export function getExample(id: string): Response {
  if (!Object.hasOwn(EXAMPLES, id)) return fail(404, 'Unknown example.');
  return json(200, EXAMPLES[id], { 'cache-control': 'public, max-age=300' });
}
