import { describe, expect, it } from 'vitest';
import { VisionResult, PATCH_IDS, Context } from '../shared/schema';
import { gridRegions } from '../shared/grid';
import { parseModelText } from '../server/inference';
import example from '../data/example-run.json';

const good = () => ({ observations: PATCH_IDS.map((id) => ({ id, surface: 'lawn', material: 'fallen_leaves', visibility: 'clear', evidence: 'Leaves on grass.' })) });

describe('model response contract', () => {
  it('accepts exactly nine unique cells', () => expect(VisionResult.safeParse(good()).success).toBe(true));
  it('rejects missing cells', () => {
    const v = good(); v.observations.pop();
    expect(VisionResult.safeParse(v).success).toBe(false);
  });
  it('rejects duplicate IDs', () => {
    const v = good(); v.observations[8].id = 'A1';
    expect(VisionResult.safeParse(v).success).toBe(false);
  });
  it('rejects invalid enums and empty evidence', () => {
    const v = good(); (v.observations[0] as any).surface = 'meadow';
    expect(VisionResult.safeParse(v).success).toBe(false);
    const w = good(); w.observations[0].evidence = '';
    expect(VisionResult.safeParse(w).success).toBe(false);
  });
  it('parseModelText reports non-JSON and trims overlong evidence', () => {
    expect(parseModelText('Sure! Here is').ok).toBe(false);
    const v = good(); v.observations[0].evidence = 'x'.repeat(300);
    const r = parseModelText(JSON.stringify(v));
    expect(r.ok && r.value.observations[0].evidence.length).toBeLessThanOrEqual(160);
  });
  it('context is strict', () => {
    expect(Context.safeParse({ region: 'temperate_na', season: 'autumn', concerns: 'none', extra: 1 }).success).toBe(false);
  });
});

describe('grid geometry', () => {
  it.each([[1536, 1152], [1001, 677], [7, 5], [1536, 1536]])('covers %ix%i exactly once', (W, H) => {
    const rs = gridRegions(W, H);
    expect(rs.reduce((a, r) => a + r.width * r.height, 0)).toBe(W * H);
    expect(Math.max(...rs.map((r) => r.left + r.width))).toBe(W);
    expect(Math.max(...rs.map((r) => r.top + r.height))).toBe(H);
    for (let row = 0; row < 3; row++) {
      const cells = rs.slice(row * 3, row * 3 + 3);
      expect(cells[0].left).toBe(0);
      expect(cells[1].left).toBe(cells[0].left + cells[0].width);
      expect(cells[2].left).toBe(cells[1].left + cells[1].width);
    }
  });
});

describe('recorded example', () => {
  it('is a valid, clearly labeled recorded run', () => {
    expect(example.provenance.mode).toBe('recorded');
    expect(example.provenance.normalizedImageSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(VisionResult.safeParse({ observations: example.observations }).success).toBe(true);
  });
});
