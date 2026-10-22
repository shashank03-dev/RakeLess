import { describe, expect, it } from 'vitest';
import { decide, summarize } from '../shared/rules';
import { PATCH_IDS, type Context, type Observation } from '../shared/schema';

const ok: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };
const fill = (over: Partial<Observation> = {}, at: Partial<Record<string, Partial<Observation>>> = {}): Observation[] =>
  PATCH_IDS.map((id) => ({ id, surface: 'unknown', material: 'no_relevant_leaves', visibility: 'clear', evidence: 'x', ...over, ...at[id] }));
const one = (o: Partial<Observation>, ctx = ok, corrections = []) => decide(fill({}, { B2: o }), ctx, corrections).find((d) => d.id === 'B2')!;

describe('decision rules', () => {
  it('bed + leaves + clear + in scope + no concerns -> leave for now, with habitat source', () => {
    const d = one({ surface: 'bed_or_tree_base', material: 'fallen_leaves' });
    expect(d.action).toBe('leave');
    expect(d.sourceIds).toContain('habitat');
    expect(d.detail).toMatch(/inspect the patch first/);
  });
  it('lawn + leaves -> review with turf source', () => {
    const d = one({ surface: 'lawn', material: 'fallen_leaves' });
    expect(d.action).toBe('review');
    expect(d.sourceIds).toEqual(['turf']);
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
});
