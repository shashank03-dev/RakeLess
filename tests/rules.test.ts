import { describe, expect, it } from 'vitest';
import { decide, summarize } from '../shared/rules';
import { MATERIALS, PATCH_IDS, SURFACES, VISIBILITIES, type Context, type Correction, type Observation } from '../shared/schema';

const ok: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };
const fill = (over: Partial<Observation> = {}, at: Partial<Record<string, Partial<Observation>>> = {}): Observation[] =>
  PATCH_IDS.map((id) => ({ id, surface: 'unknown', material: 'no_relevant_leaves', visibility: 'clear', evidence: 'x', ...over, ...at[id] }));
const one = (o: Partial<Observation>, ctx = ok, corrections: Correction[] = []) => decide(fill({}, { B2: o }), ctx, corrections).find((d) => d.id === 'B2')!;

describe('decision rules', () => {
  it('bed + leaves + clear + in scope + no concerns -> leave for now, with habitat source', () => {
    const d = one({ surface: 'bed_or_tree_base', material: 'fallen_leaves' });
    expect(d.action).toBe('leave');
    expect(d.sourceIds).toContain('habitat');
    expect(d.detail).toMatch(/walk the patch first/);
  });
  it('lawn + leaves -> review with turf source', () => {
    const d = one({ surface: 'lawn', material: 'fallen_leaves' });
    expect(d.action).toBe('review');
    expect(d.sourceIds).toEqual(['turf', 'cleanup']);
  });
  it('path + leaves -> check-and-clear suggestion (model only), clear (user confirmed)', () => {
    expect(one({ surface: 'path_or_steps', material: 'fallen_leaves' })).toMatchObject({ action: 'clear', title: 'Check and clear leaves from this access route', basis: 'model' });
    const confirmed = decide(fill({}, { B2: { surface: 'path_or_steps', material: 'fallen_leaves' } }), ok, [{ id: 'B2', surface: 'path_or_steps' }]).find((d) => d.id === 'B2')!;
    expect(confirmed).toMatchObject({ action: 'clear', title: 'Clear leaves from this access route', basis: 'user' });
  });
  it.each([
    [{ surface: 'mixed', material: 'fallen_leaves' }],
    [{ surface: 'unknown', material: 'fallen_leaves' }],
    [{ surface: 'bed_or_tree_base', material: 'fallen_leaves', visibility: 'unclear' }],
    [{ surface: 'bed_or_tree_base', material: 'mixed_or_unclear' }],
  ] as Partial<Observation>[][])('unclear/mixed/unknown -> review %#', (o) => {
    expect(one(o).action).toBe('review');
  });
  it('unresolved or known concerns -> never leave', () => {
    const bed = { surface: 'bed_or_tree_base', material: 'fallen_leaves' } as const;
    expect(one(bed, { ...ok, concerns: 'not_sure' }).action).toBe('review');
    expect(one(bed, { ...ok, concerns: 'yes' }).action).toBe('review');
    const marked = decide(fill({}, { B2: bed }), ok, [{ id: 'B2', siteConcern: true }]).find((d) => d.id === 'B2')!;
    expect(marked.action).toBe('review');
    expect(marked.detail).not.toMatch(/burn(?!ing advice)|compost/i);
  });
  it('outside scope -> no automatic ecology recommendation', () => {
    const all = decide(fill({ surface: 'bed_or_tree_base', material: 'fallen_leaves' }), { ...ok, region: 'other' });
    expect(all.every((d) => d.action === 'review')).toBe(true);
    expect(decide(fill({ surface: 'path_or_steps', material: 'fallen_leaves' }), { ...ok, season: 'other' }).every((d) => d.action === 'review')).toBe(true);
  });
  it('no leaves -> no leaf task, not counted as a chore saved', () => {
    const ds = decide(fill(), ok);
    expect(ds.every((d) => d.action === 'none')).toBe(true);
    expect(summarize(ds).leave).toBe(0);
  });
  it('corrections change decisions and keep the original observation untouched', () => {
    const obs = fill({}, { B2: { surface: 'lawn', material: 'fallen_leaves' } });
    const snapshot = JSON.stringify(obs);
    expect(decide(obs, ok).find((d) => d.id === 'B2')!.action).toBe('review');
    const after = decide(obs, ok, [{ id: 'B2', surface: 'bed_or_tree_base' }]).find((d) => d.id === 'B2')!;
    expect(after).toMatchObject({ action: 'leave', basis: 'user' });
    expect(JSON.stringify(obs)).toBe(snapshot);
  });
  it('refuses to plan without nine observations', () => {
    expect(() => decide(fill().slice(0, 8), ok)).toThrow();
  });

  it('regression: an unclear path with leaves is routed to review, not clear', () => {
    const d = one({ surface: 'path_or_steps', material: 'fallen_leaves', visibility: 'unclear' });
    expect(d).toMatchObject({ action: 'review', ruleId: 'R5', title: 'Inspect this possible access route' });
    expect(d.detail).toMatch(/not clearly visible/);
  });
  it('regression: a path with unclear material is review, even with concerns unresolved', () => {
    for (const concerns of ['none', 'yes', 'not_sure'] as const) {
      expect(one({ surface: 'path_or_steps', material: 'mixed_or_unclear' }, { ...ok, concerns }).action).toBe('review');
    }
  });
  it('ambiguous lawn/bed boundary (mixed) never becomes leave, whatever the context', () => {
    for (const concerns of ['none', 'yes', 'not_sure'] as const) {
      const d = one({ surface: 'mixed', material: 'fallen_leaves' }, { ...ok, concerns });
      expect(d.action).toBe('review');
      expect(d.detail).toMatch(/mixes surfaces/);
    }
  });
  it('a clear path with leaves is still clear when site concerns are flagged (access work is kept)', () => {
    expect(one({ surface: 'path_or_steps', material: 'fallen_leaves' }, { ...ok, concerns: 'yes' }).action).toBe('clear');
  });
  it('unclear visibility with "no leaves" is not a no-task patch', () => {
    expect(one({ surface: 'lawn', material: 'no_relevant_leaves', visibility: 'unclear' }).action).toBe('review');
  });
  it('a site concern on a leafless patch is reviewed, not dismissed', () => {
    const d = decide(fill({}, { B2: { surface: 'bed_or_tree_base' } }), ok, [{ id: 'B2', siteConcern: true }]).find((x) => x.id === 'B2')!;
    expect(d.action).toBe('review');
  });
  it('a user on-site check (visibility correction) can resolve photo doubt, and is marked as the user’s', () => {
    const obs = fill({}, { B2: { surface: 'path_or_steps', material: 'fallen_leaves', visibility: 'unclear' } });
    const d = decide(obs, ok, [{ id: 'B2', visibility: 'clear', surface: 'path_or_steps' }]).find((x) => x.id === 'B2')!;
    expect(d).toMatchObject({ action: 'clear', basis: 'user', title: 'Clear leaves from this access route' });
    expect(obs.find((o) => o.id === 'B2')!.visibility).toBe('unclear');
  });
  it('exhaustive: leave only for clear bed + leaves, in scope, no concerns; clear only for clear path + leaves in scope', () => {
    const contexts: Context[] = [];
    for (const region of ['temperate_na', 'other', 'unsure'] as const)
      for (const season of ['autumn', 'other'] as const)
        for (const concerns of ['none', 'yes', 'not_sure'] as const) contexts.push({ region, season, concerns });
    let n = 0;
    for (const ctx of contexts)
      for (const surface of SURFACES)
        for (const material of MATERIALS)
          for (const visibility of VISIBILITIES)
            for (const siteConcern of [false, true]) {
              const corr: Correction[] = siteConcern ? [{ id: 'B2', siteConcern: true }] : [];
              const d = one({ surface, material, visibility }, ctx, corr);
              n++;
              const scoped = ctx.region === 'temperate_na' && ctx.season === 'autumn';
              const clearView = visibility === 'clear' && material !== 'mixed_or_unclear' && surface !== 'mixed' && surface !== 'unknown';
              if (d.action === 'leave') {
                expect({ scoped, clearView, surface, material, concerns: ctx.concerns, siteConcern }).toEqual({ scoped: true, clearView: true, surface: 'bed_or_tree_base', material: 'fallen_leaves', concerns: 'none', siteConcern: false });
              }
              if (d.action === 'clear') {
                expect({ scoped, clearView, surface, material }).toEqual({ scoped: true, clearView: true, surface: 'path_or_steps', material: 'fallen_leaves' });
              }
              if (d.action === 'none') {
                expect({ material, visibility, siteConcern }).toEqual({ material: 'no_relevant_leaves', visibility: 'clear', siteConcern: false });
              }
              if (visibility === 'unclear') expect(d.action).toBe('review');
            }
    expect(n).toBe(18 * 5 * 3 * 2 * 2);
  });
});

describe('chore receipt', async () => {
  const { buildReceipt } = await import('../shared/receipt');
  const obs = fill({}, {
    A1: { surface: 'bed_or_tree_base', material: 'fallen_leaves' },
    A2: { surface: 'path_or_steps', material: 'fallen_leaves' },
    A3: { surface: 'lawn', material: 'fallen_leaves' },
    B1: { surface: 'path_or_steps', material: 'fallen_leaves', visibility: 'unclear' },
  });
  it('never invents a plan: nothing intended means nothing reconsidered', () => {
    const r = buildReceipt(obs, decide(obs, ok), [], [], ok);
    expect(r.intendedCount).toBe(0);
    expect(r.reconsider).toHaveLength(0);
    expect(r.keepAccess.map((l) => l.id)).toEqual(['A2']);
    expect(r.otherReview).toEqual(['A3', 'B1']);
  });
  it('sorts intended patches; canopy/no-leaf cells are no-task, never "saved"', () => {
    const r = buildReceipt(obs, decide(obs, ok), [], ['A1', 'A2', 'A3', 'B1', 'C3'], ok);
    expect(r.reconsider.map((l) => l.id)).toEqual(['A1']);
    expect(r.keepAccess.map((l) => [l.id, l.intended])).toEqual([['A2', true]]);
    expect(r.inspect.map((l) => l.id)).toEqual(['A3', 'B1']);
    expect(r.noTask.map((l) => l.id)).toEqual(['C3']);
    expect(JSON.stringify(r)).not.toMatch(/minute|hour|area|m²|carbon|\$/i);
  });
  it('keeps original and corrected values side by side', () => {
    const corr: Correction[] = [{ id: 'A3', surface: 'bed_or_tree_base' }];
    const r = buildReceipt(obs, decide(obs, ok, corr), corr, ['A3'], ok);
    expect(r.reconsider[0]).toMatchObject({ id: 'A3', original: { surface: 'lawn' }, final: { surface: 'bed_or_tree_base' }, changes: [{ field: 'surface', from: 'lawn', to: 'bed_or_tree_base' }] });
    expect(r.reconsider[0].decision.basis).toBe('user');
  });
  it('unresolved site concerns move planned bed cleanup to inspection, not to reconsider', () => {
    const ctx = { ...ok, concerns: 'not_sure' as const };
    const r = buildReceipt(obs, decide(obs, ctx), [], ['A1'], ctx);
    expect(r.reconsider).toHaveLength(0);
    expect(r.inspect.map((l) => l.id)).toEqual(['A1']);
  });
});
