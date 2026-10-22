/**
 * Records the bundled example from a REAL model run. Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/record-example.ts <original-photo.jpg>
 * Writes the normalized photo to public/examples/ and the run to data/example-run.json.
 */
import fs from 'node:fs';
import { normalizeImage } from '../server/image';
import { observe, MODEL_NAME, PROMPT_VERSION } from '../server/inference';
import { RULES_VERSION } from '../shared/rules';
import type { AnalyzeResponse } from '../shared/schema';

const src = process.argv[2];
if (!src) throw new Error('Pass the original photo path.');
const img = await normalizeImage(fs.readFileSync(src));
fs.writeFileSync('public/examples/fallen-leaves.jpg', img.buffer);
const out = await observe(img);
const run: AnalyzeResponse & { attribution: unknown } = {
  image: { width: img.width, height: img.height, src: '/examples/fallen-leaves.jpg' },
  observations: out.observations,
  provenance: {
    mode: 'recorded',
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
console.log(JSON.stringify({ durationMs: out.durationMs, retry: out.retryCount, model: out.modelVersion }, null, 2));
for (const o of out.observations) console.log(o.id, o.surface, o.material, o.visibility, '-', o.evidence);
