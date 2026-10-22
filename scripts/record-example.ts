/**
 * Records the bundled example from a REAL model run with the configured provider. Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/record-example.ts <original-photo.jpg>
 *   RAKELESS_PROVIDER=ollama npx tsx scripts/record-example.ts <original-photo.jpg>
 * Writes the normalized photo to public/examples/ and the run to data/example-run.json.
 */
import fs from 'node:fs';
import { normalizeImage } from '../server/image.js';
import { currentProvider, observe, PROMPT_VERSION, TIMING } from '../server/inference.js';
import { RULES_VERSION } from '../shared/rules.js';
import type { AnalyzeResponse } from '../shared/schema.js';

const src = process.argv[2];
if (!src) throw new Error('Pass the original photo path.');
const t0 = Date.now();
const img = await normalizeImage(fs.readFileSync(src));
fs.writeFileSync('public/examples/fallen-leaves.jpg', img.buffer);
const p = currentProvider();
const out = await observe(img, { deadline: Date.now() + TIMING.requestBudgetMs });
const run: AnalyzeResponse & { attribution: unknown } = {
  image: { width: img.width, height: img.height, src: '/examples/fallen-leaves.jpg' },
  observations: out.observations,
  provenance: {
    mode: 'recorded',
    provider: p.id,
    providerLabel: p.label,
    localInference: p.local,
    modelName: p.modelName,
    modelVersion: out.modelVersion,
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
    normalizedImageSha256: img.sha256,
    timestampUtc: new Date().toISOString(),
    durationMs: out.inferenceMs,
    requestMs: Date.now() - t0,
    attempts: out.attempts,
    retryCount: out.attempts - 1,
    cacheHit: false,
  },
  attribution: {
    title: 'Fallen Leaves October 2011',
    author: 'Michael Gil',
    place: 'Ontario, Canada',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fallen_Leaves_October_2011.jpg',
    modifications: 'Resized to 1536 px on the long side and re-encoded; grid overlay drawn by RakeLess.',
  },
};
fs.writeFileSync('data/example-run.json', JSON.stringify(run, null, 2) + '\n');
console.log(JSON.stringify({ inferenceMs: out.inferenceMs, attempts: out.attempts, model: out.modelVersion }, null, 2));
for (const o of out.observations) console.log(o.id, o.surface, o.material, o.visibility, '-', o.evidence);
