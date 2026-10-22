import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PATCH_IDS } from '../shared/schema';
import { _resetGuards } from '../server/guard';

process.env.GEMINI_API_KEY = 'test-key';
process.env.MODEL_TIMEOUT_MS = '300';
const { analyze, getExample, health } = await import('../server/handlers');
const { normalizeImage } = await import('../server/image');

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

beforeEach(() => _resetGuards());
afterEach(() => { globalThis.fetch = realFetch; });

describe('POST /api/analyze', () => {
  it('returns nine observations and live provenance', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    const r = await analyze(req(await jpeg()));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.observations).toHaveLength(9);
    expect(b.provenance).toMatchObject({ mode: 'live', retryCount: 0, cacheHit: false });
  });
  it('labels a repeat as a cache hit without calling the model', async () => {
    mockModel(async () => Response.json(modelBody(goodObs)));
    const img = await jpeg(70, 50);
    await analyze(req(img));
    const second = await (await analyze(req(img))).json();
    expect(second.provenance.cacheHit).toBe(true);
    expect((globalThis.fetch as any).mock.calls).toHaveLength(1);
  });
  it('retries once on invalid structure, then 502', async () => {
    mockModel(async () => Response.json(modelBody(goodObs.slice(0, 8))));
    const r = await analyze(req(await jpeg(80, 60)));
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/invalid structure/);
    expect((globalThis.fetch as any).mock.calls).toHaveLength(2);
  });
  it('recovers when the retry is valid', async () => {
    mockModel(async (n) => Response.json(modelBody(n === 0 ? [{ id: 'A1' }] : goodObs)));
    const b = await (await analyze(req(await jpeg(81, 60)))).json();
    expect(b.provenance.retryCount).toBe(1);
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
  it('health separates app and model readiness', async () => {
    mockModel(async () => new Response('{}', { status: 404 }));
    const b = await (await health()).json();
    expect(b.app.ready).toBe(true);
    expect(b.model.ready).toBe(false);
    expect(b.model.reason).toBeTruthy();
  });
  it('examples: only bundled IDs, recorded mode', async () => {
    expect((await getExample('fallen-leaves').json()).provenance.mode).toBe('recorded');
    expect(getExample('../../etc/passwd').status).toBe(404);
    expect(getExample('constructor').status).toBe(404);
  });
});
