/**
 * Reproducible evaluation run against eval/manifest.json with the configured provider.
 *
 *   RAKELESS_PROVIDER=ollama OLLAMA_MODEL=gemma4:e4b npm run eval
 *   GEMINI_API_KEY=... npm run eval -- --split evaluation
 *   npm run eval -- --only s02 --label offline-check
 *
 * Every scene makes fresh upstream calls (the observation cache is not used here).
 * References in the manifest were written before the model was run on that scene; see eval/README.md.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeImage } from '../server/image.js';
import { currentProvider, ModelError, observe, PROMPT_VERSION, TIMING } from '../server/inference.js';
import { decide, RULES_VERSION } from '../shared/rules.js';
import { PATCH_IDS, type Action, type Context, type Observation } from '../shared/schema.js';

type RefCell = Omit<Observation, 'evidence'> & { note?: string };
type Scene = {
  id: string;
  split: 'development' | 'evaluation';
  file: string;
  inputSha256: string;
  context: Context;
  contextSource: string;
  covers: string[];
  reference: RefCell[];
};

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const manifest = JSON.parse(fs.readFileSync('eval/manifest.json', 'utf8')) as { scenes: Scene[] };
const only = arg('only')?.split(',');
const split = arg('split');
const scenes = manifest.scenes.filter((s) => (!only || only.includes(s.id)) && (!split || s.split === split));
const p = currentProvider();
const IN_SCOPE: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };

const results = [];
for (const s of scenes) {
  const buf = fs.readFileSync(path.join('eval', s.file));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== s.inputSha256) throw new Error(`${s.id}: input hash mismatch (${sha})`);
  const t0 = Date.now();
  const img = await normalizeImage(buf);
  let out: Awaited<ReturnType<typeof observe>> | null = null;
  let error: { status: number; message: string; attempts: number } | null = null;
  try {
    out = await observe(img, { deadline: Date.now() + TIMING.requestBudgetMs });
  } catch (e) {
    error = e instanceof ModelError ? { status: e.status, message: e.message, attempts: e.attempts } : { status: 500, message: String(e), attempts: 0 };
  }
  const wallMs = Date.now() - t0;
  const ref = PATCH_IDS.map((id) => ({ ...s.reference.find((r) => r.id === id)!, evidence: 'reference' }));
  const row: Record<string, unknown> = {
    scene: s.id, split: s.split, covers: s.covers, context: s.context, contextSource: s.contextSource,
    normalizedImageSha256: img.sha256, wallMs, schemaOk: !!out, error,
  };
  if (out) {
    const m = out.observations;
    const refDoc = decide(ref, s.context), modelDoc = decide(m, s.context);
    const refIn = decide(ref, IN_SCOPE), modelIn = decide(m, IN_SCOPE);
    row.inferenceMs = out.inferenceMs;
    row.attempts = out.attempts;
    row.modelVersion = out.modelVersion;
    row.cells = PATCH_IDS.map((id, i) => ({
      id,
      ground: !(ref[i].surface === 'unknown' && ref[i].material === 'no_relevant_leaves'),
      reference: { surface: ref[i].surface, material: ref[i].material, visibility: ref[i].visibility },
      model: { surface: m[i].surface, material: m[i].material, visibility: m[i].visibility, evidence: m[i].evidence },
      action: { documented: { reference: refDoc[i].action, model: modelDoc[i].action, rule: modelDoc[i].ruleId }, inScope: { reference: refIn[i].action, model: modelIn[i].action, rule: modelIn[i].ruleId } },
    }));
  }
  results.push(row);
  console.log(`${s.id} ${out ? 'ok' : `FAILED ${error?.status}`} wall ${(wallMs / 1000).toFixed(1)} s${out ? ` · inference ${(out.inferenceMs / 1000).toFixed(1)} s · attempts ${out.attempts}` : ''}`);
}

// ---- metrics (counts with denominators; no averaging across different denominators) ----
type Cell = { ground: boolean; reference: Record<string, string>; model: Record<string, string>; action: Record<'documented' | 'inScope', { reference: Action; model: Action }> };
const ok = results.filter((r) => r.schemaOk);
const cells = ok.flatMap((r) => r.cells as Cell[]);
const ground = cells.filter((c) => c.ground);
const frac = (n: number, d: number) => ({ n, d, pct: d ? Math.round((1000 * n) / d) / 10 : null });
const agree = (cs: Cell[], k: string) => frac(cs.filter((c) => c.reference[k] === c.model[k]).length, cs.length);
const actionStats = (cs: Cell[], key: 'documented' | 'inScope') => {
  const a = cs.map((c) => c.action[key]);
  const actionable = a.filter((x) => x.reference === 'leave' || x.reference === 'clear');
  const critical = a.filter((x) => (x.model === 'leave' && x.reference !== 'leave') || (x.model === 'none' && x.reference !== 'none'));
  const confusion: Record<string, number> = {};
  for (const x of a) confusion[`${x.reference}→${x.model}`] = (confusion[`${x.reference}→${x.model}`] ?? 0) + 1;
  return {
    agreement: frac(a.filter((x) => x.reference === x.model).length, a.length),
    modelReviewRate: frac(a.filter((x) => x.model === 'review').length, a.length),
    actionableCoverage: frac(actionable.filter((x) => x.model === x.reference).length, actionable.length),
    criticalConfusions: frac(critical.length, a.length),
    confusion,
  };
};
const summary = {
  runAtUtc: new Date().toISOString(),
  provider: p.id, providerLabel: p.label, localInference: p.local, modelName: p.modelName,
  modelVersion: (ok[0]?.modelVersion as string | undefined) ?? null,
  promptVersion: PROMPT_VERSION, rulesVersion: RULES_VERSION,
  label: arg('label') ?? null,
  scenes: results.length,
  schemaSuccess: frac(ok.length, results.length),
  totalAttempts: ok.reduce((a, r) => a + (r.attempts as number), 0) + results.filter((r) => !r.schemaOk).reduce((a, r) => a + ((r.error as { attempts: number }).attempts ?? 0), 0),
  scenesNeedingRetry: ok.filter((r) => (r.attempts as number) > 1).length,
  wallMs: results.map((r) => r.wallMs), inferenceMs: ok.map((r) => r.inferenceMs),
  observation: {
    allCells: { surface: agree(cells, 'surface'), material: agree(cells, 'material'), visibility: agree(cells, 'visibility') },
    groundCells: { surface: agree(ground, 'surface'), material: agree(ground, 'material'), visibility: agree(ground, 'visibility') },
  },
  actions: {
    documentedContext: { allCells: actionStats(cells, 'documented'), groundCells: actionStats(ground, 'documented') },
    inScopeCounterfactual: { allCells: actionStats(cells, 'inScope'), groundCells: actionStats(ground, 'inScope') },
  },
};
const id = `${new Date().toISOString().slice(0, 10)}-${p.id}-${p.modelName.replace(/[^a-z0-9.]+/gi, '_')}${arg('label') ? `-${arg('label')}` : ''}`;
fs.mkdirSync('eval/results', { recursive: true });
fs.writeFileSync(`eval/results/${id}.json`, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
console.log(`wrote eval/results/${id}.json`);
