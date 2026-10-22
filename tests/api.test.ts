import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PATCH_IDS } from '../shared/schema';
import { _resetGuards, _usage, clientIp } from '../server/guard';
import { observationCache } from '../server/cache';

process.env.GEMINI_API_KEY = 'test-key';
process.env.MODEL_TIMEOUT_MS = '300';
const { analyze, getExample, health } = await import('../server/handlers');
const { normalizeImage } = await import('../server/image');
const { _resetHealth, _setProvider, currentProvider } = await import('../server/inference');
const { ollamaProvider } = await import('../server/providers/ollama');
const gemini = currentProvider();

const realFetch = globalThis.fetch;
const ctx = JSON.stringify({ region: 'temperate_na', season: 'autumn', concerns: 'none' });
const jpeg = (w = 64, h = 48) => sharp({ create: { width: w, height: h, channels: 3, background: '#a56624' } }).jpeg().toBuffer();
const modelBody = (obs: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ observations: obs }) }] } }], modelVersion: 'gemma-test' });
const goodObs = PATCH_IDS.map((id) => ({ id, surface: 'bed_or_tree_base', material: 'fallen_leaves', visibility: 'clear', evidence: 'Leaves.' }));

function req(body: Buffer | null, opts: { type?: string; context?: string; origin?: string | null } = {}) {
  const form = new FormData();
  if (body) form.append('image', new Blob([new Uint8Array(body)], { type: opts.type ?? 'image/jpeg' }), 'x.jpg');
  form.append('context', opts.context ?? ctx);
  const headers: Record<string, string> = { host: 'localhost' };
  if (opts.origin !== null) headers.origin = opts.origin ?? 'http://localhost';
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form, headers });
}
const mockModel = (impl: (n: number, init?: RequestInit) => Promise<Response>) => {
  let n = 0;
  globalThis.fetch = vi.fn((_u: any, init?: RequestInit) => impl(n++, init)) as any;
};

const ENV_KEYS = ['REQUEST_BUDGET_MS', 'MIN_ATTEMPT_MS', 'DAILY_MODEL_CALLS', 'OBSERVATION_CACHE_TTL_MS', 'MODEL_TIMEOUT_MS', 'VERCEL', 'TRUST_PROXY'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
beforeEach(() => { _resetGuards(); observationCache.clear(); _setProvider(gemini); _resetHealth(); });
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
});
const calls = () => (globalThis.fetch as any).mock.calls.length as number;

describe('POST /api/analyze', () => {
  it('returns nine observations and live provenance', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    const r = await analyze(req(await jpeg()));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.observations).toHaveLength(9);
    expect(b.provenance).toMatchObject({ mode: 'live', provider: 'gemini', localInference: false, attempts: 1, retryCount: 0, cacheHit: false });
    expect(b.provenance.requestMs).toBeGreaterThanOrEqual(b.provenance.durationMs);
  });
  it('labels a repeat as a cache hit without calling the model', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    const img = await jpeg(70, 50);
    await analyze(req(img));
    const second = await (await analyze(req(img))).json();
    expect(second.provenance).toMatchObject({ cacheHit: true, attempts: 0 });
    expect(second.provenance.cachedAtUtc).toBeTruthy();
    expect(second.image.src).toMatch(/^data:image\/jpeg;base64,/);
    expect((globalThis.fetch as any).mock.calls).toHaveLength(1);
  });
  it('the cache holds observations only — no image bytes, no full response', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    const r = await (await analyze(req(await jpeg(71, 50)))).json();
    const dump = JSON.stringify(observationCache._dump());
    expect(dump).not.toContain('base64');
    expect(dump).not.toContain(r.image.src.slice(30, 90));
    expect(Object.keys(observationCache._dump()[0]).sort()).toEqual(['attempts', 'inferenceMs', 'modelVersion', 'observations', 'storedAt']);
  });
  it('cache entries expire after the TTL and the model is called again', async () => {
    process.env.OBSERVATION_CACHE_TTL_MS = '40';
    mockModel(async () => Response.json(modelBody(goodObs)));
    const img = await jpeg(72, 50);
    await analyze(req(img));
    await new Promise((r) => setTimeout(r, 60));
    const again = await (await analyze(req(img))).json();
    expect(again.provenance.cacheHit).toBe(false);
    expect(calls()).toBe(2);
  });
  it('cache can be disabled with TTL 0', async () => {
    process.env.OBSERVATION_CACHE_TTL_MS = '0';
    mockModel(async () => Response.json(modelBody(goodObs)));
    const img = await jpeg(73, 50);
    await analyze(req(img));
    await analyze(req(img));
    expect(calls()).toBe(2);
    expect(observationCache.size()).toBe(0);
  });
  it('retries once on invalid structure, then 502', async () => {
    mockModel(async () => Response.json(modelBody(goodObs.slice(0, 8))));
    const r = await analyze(req(await jpeg(80, 60)));
    expect(r.status).toBe(502);
    const b = await r.json();
    expect(b.error).toMatch(/valid answer in 2 attempts/);
    expect(b.attempts).toBe(2);
    expect((globalThis.fetch as any).mock.calls).toHaveLength(2);
    expect(_usage().dayCount).toBe(2);
  });
  it('recovers when the retry is valid', async () => {
    mockModel(async (n) => Response.json(modelBody(n === 0 ? [{ id: 'A1' }] : goodObs)));
    const b = await (await analyze(req(await jpeg(81, 60)))).json();
    expect(b.provenance).toMatchObject({ retryCount: 1, attempts: 2 });
  });
  it('does not start a retry the deadline cannot fit', async () => {
    process.env.REQUEST_BUDGET_MS = '5000';
    process.env.MIN_ATTEMPT_MS = '10000';
    mockModel(async () => Response.json(modelBody(goodObs.slice(0, 8))));
    const r = await analyze(req(await jpeg(86, 60)));
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/not enough time to retry/);
    expect(calls()).toBe(1);
  });
  it('the request-wide deadline caps an attempt even when the per-attempt cap is larger', async () => {
    process.env.REQUEST_BUDGET_MS = '3000';
    process.env.MODEL_TIMEOUT_MS = '60000';
    mockModel((_n, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    const t = Date.now();
    const r = await analyze(req(await jpeg(87, 60)));
    expect(r.status).toBe(504);
    expect(Date.now() - t).toBeLessThan(2500);
  });
  it('retries a transient upstream 5xx once and counts both attempts', async () => {
    mockModel(async (n) => (n === 0 ? new Response('busy', { status: 503 }) : Response.json(modelBody(goodObs))));
    const b = await (await analyze(req(await jpeg(88, 60)))).json();
    expect(b.provenance).toMatchObject({ attempts: 2, retryCount: 1 });
    expect(_usage().dayCount).toBe(2);
  });
  it('never retries quota, auth, or bad requests', async () => {
    for (const [status, expected] of [[429, 429], [403, 503], [400, 502]] as const) {
      _resetGuards();
      mockModel(async () => new Response('{}', { status }));
      const r = await analyze(req(await jpeg(89, 60 + status % 7)));
      expect(r.status).toBe(expected);
      expect(calls()).toBe(1);
    }
  });
  it('handles a non-JSON provider body as a schema failure and retries', async () => {
    mockModel(async (n) => (n === 0 ? Response.json({ candidates: [{ content: { parts: [{ text: 'Sure! Here are' }] } }] }) : Response.json(modelBody(goodObs))));
    const b = await (await analyze(req(await jpeg(90, 61)))).json();
    expect(b.provenance.attempts).toBe(2);
  });
  it('the daily budget counts retries: a retry is not started once the budget is spent', async () => {
    process.env.DAILY_MODEL_CALLS = '1';
    mockModel(async () => Response.json(modelBody(goodObs.slice(0, 8))));
    const r = await analyze(req(await jpeg(91, 61)));
    expect(r.status).toBe(502);
    expect(calls()).toBe(1);
    const next = await analyze(req(await jpeg(92, 61)));
    expect(next.status).toBe(429);
    expect(calls()).toBe(1);
  });
  it('a cancelled request aborts the upstream call', async () => {
    let upstreamAborted = false;
    mockModel((_n, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => { upstreamAborted = true; rej(new Error('aborted')); })));
    const ctrl = new AbortController();
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(await jpeg(93, 61))], { type: 'image/jpeg' }), 'x.jpg');
    form.append('context', ctx);
    const pending = analyze(new Request('http://localhost/api/analyze', { method: 'POST', body: form, headers: { host: 'localhost', origin: 'http://localhost' }, signal: ctrl.signal }));
    await new Promise((r) => setTimeout(r, 80));
    ctrl.abort();
    const r = await pending;
    expect(r.status).toBe(499);
    expect(upstreamAborted).toBe(true);
  });
  it('rejects more than one image field', async () => {
    const form = new FormData();
    const b = new Blob([new Uint8Array(await jpeg())], { type: 'image/jpeg' });
    form.append('image', b, 'a.jpg'); form.append('image', b, 'b.jpg'); form.append('context', ctx);
    const r = await analyze(new Request('http://localhost/api/analyze', { method: 'POST', body: form, headers: { host: 'localhost', origin: 'http://localhost' } }));
    expect(r.status).toBe(400);
  });
  it('times out with 504, never a fake success', async () => {
    mockModel((_n, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    const r = await analyze(req(await jpeg(82, 60)));
    expect(r.status).toBe(504);
    expect(await r.json()).not.toHaveProperty('observations');
  });
  it('503 when the model is not configured', async () => {
    const k = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
    const r = await analyze(req(await jpeg(83, 60)));
    process.env.GEMINI_API_KEY = k;
    expect(r.status).toBe(503);
  });
  it('409 while another analysis is in flight', async () => {
    let release!: () => void;
    mockModel(() => new Promise((res) => { release = () => res(Response.json(modelBody(goodObs))); }));
    const first = analyze(req(await jpeg(84, 60)));
    await new Promise((r) => setTimeout(r, 50));
    const second = await analyze(req(await jpeg(85, 60)));
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
  });
  it('429 after the per-visitor limit', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await analyze(req(await jpeg(90 + i, 60)))).status;
    expect(last).toBe(429);
  });
  it('rejects cross-origin posts', async () => {
    expect((await analyze(req(await jpeg(), { origin: 'https://evil.example' }))).status).toBe(403);
  });
  it('rejects unsupported, corrupt, and missing uploads with 400', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).gif().toBuffer();
    expect((await analyze(req(gif, { type: 'image/jpeg' }))).status).toBe(400);
    const corrupt = (await jpeg()).subarray(0, 40);
    expect((await analyze(req(corrupt))).status).toBe(400);
    expect((await analyze(req(Buffer.from('hello')))).status).toBe(400);
    expect((await analyze(req(null))).status).toBe(400);
    expect((await analyze(req(await jpeg(), { context: '{"region":"mars"}' }))).status).toBe(400);
  });
  it('rejects oversize files and oversize decoded pixels with 413', async () => {
    expect((await analyze(req(Buffer.alloc(8 * 1024 * 1024 + 10)))).status).toBe(413);
    const huge = await sharp({ create: { width: 5000, height: 4100, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
    expect((await analyze(req(huge, { type: 'image/png' }))).status).toBe(413);
  });
});

describe('image normalization', () => {
  it('applies EXIF orientation, strips metadata, and caps the long side', async () => {
    const rotated = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#555' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const n = await normalizeImage(rotated);
    expect([n.width, n.height]).toEqual([768, 1536]);
    const meta = await sharp(n.buffer).metadata();
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });
});

describe('other endpoints', () => {
  it('health separates app and model readiness, and names the provider', async () => {
    mockModel(async () => new Response('{}', { status: 404 }));
    const b = await (await health()).json();
    expect(b.app.ready).toBe(true);
    expect(b.model).toMatchObject({ ready: false, status: 'config_error', provider: 'gemini', local: false });
    expect(b.model.destination).toMatch(/Google/);
    expect(b.retention.storesImages).toBe(false);
  });
  it('health recovers: a failure is cached briefly, then re-probed', async () => {
    mockModel(async () => { throw new Error('offline'); });
    expect((await (await health()).json()).model.status).toBe('unavailable');
    mockModel(async () => Response.json({ version: '001' }));
    expect((await (await health()).json()).model.status).toBe('unavailable');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 16_000);
    const b = await (await health()).json();
    expect(b.model).toMatchObject({ status: 'ready', ready: true });
  });
  it('concurrent health checks share one upstream probe', async () => {
    mockModel(async () => { await new Promise((r) => setTimeout(r, 20)); return Response.json({}); });
    await Promise.all([health(), health(), health()]);
    expect(calls()).toBe(1);
  });
  it('examples: only bundled IDs, recorded mode', async () => {
    expect((await getExample('fallen-leaves').json()).provenance.mode).toBe('recorded');
    expect(getExample('../../etc/passwd').status).toBe(404);
    expect(getExample('constructor').status).toBe(404);
  });
});

describe('rate-limit identity', () => {
  it('ignores client-supplied forwarding headers unless a trusted proxy is configured', () => {
    delete process.env.VERCEL; delete process.env.TRUST_PROXY;
    const r = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8', 'x-rakeless-peer': '127.0.0.1' } });
    expect(clientIp(r)).toBe('127.0.0.1');
    process.env.VERCEL = '1';
    expect(clientIp(r)).toBe('5.6.7.8');
  });
});

describe('Ollama provider (mocked HTTP contract — not evidence of real inference)', () => {
  const OLLAMA = 'http://127.0.0.1:11434';
  const digest = 'b37049369adfe3d2b653af0ab301a062ca5cbe96ace6aa0d3f2559ee9b563fc2';
  const mockOllama = (chat: (body: any) => Response) => {
    const seen: { url: string; body: any }[] = [];
    globalThis.fetch = vi.fn(async (u: any, init?: RequestInit) => {
      const url = String(u);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      seen.push({ url, body });
      if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gemma4:e2b', model: 'gemma4:e2b', digest }] });
      if (url.endsWith('/api/show')) return Response.json({ capabilities: ['completion', 'vision'], details: { parameter_size: '4.6B', quantization_level: 'Q4_K_M' } });
      if (url.endsWith('/api/chat')) return chat(body);
      return new Response('', { status: 404 });
    }) as any;
    return seen;
  };
  beforeEach(() => _setProvider(ollamaProvider({ OLLAMA_URL: OLLAMA, OLLAMA_MODEL: 'gemma4:e2b' } as any)));

  it('sends the overview and nine labeled crops with the JSON schema, and records the local digest', async () => {
    const seen = mockOllama(() => Response.json({ message: { content: JSON.stringify({ observations: goodObs }) } }));
    const b = await (await analyze(req(await jpeg(94, 62)))).json();
    const chat = seen.find((s) => s.url.endsWith('/api/chat'))!.body;
    expect(chat.messages.filter((m: any) => m.images?.length === 1)).toHaveLength(10);
    expect(chat.messages.map((m: any) => m.content)).toContain('Cell C3:');
    expect(chat.format.properties.observations.minItems).toBe(9);
    expect(chat.stream).toBe(false);
    expect(b.provenance).toMatchObject({ provider: 'ollama', localInference: true, modelName: 'gemma4:e2b', modelVersion: `gemma4:e2b@sha256:${digest}` });
  });
  it('readiness reports a missing model as a configuration error with the pull command', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{"error":"not found"}', { status: 404 })) as any;
    const b = await (await health()).json();
    expect(b.model).toMatchObject({ status: 'config_error', provider: 'ollama', local: true });
    expect(b.model.reason).toMatch(/ollama pull gemma4:e2b/);
  });
  it('readiness reports an unreachable runtime as temporarily unavailable', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('fetch failed'); }) as any;
    expect((await (await health()).json()).model.status).toBe('unavailable');
  });
  it('a non-loopback endpoint is never labelled local', () => {
    expect(ollamaProvider({ OLLAMA_URL: 'http://10.0.0.5:11434' } as any).local).toBe(false);
    expect(ollamaProvider({ OLLAMA_URL: 'http://localhost:11434' } as any).local).toBe(true);
  });
});
