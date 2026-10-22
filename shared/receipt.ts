import type { Context, Correction, Decision, Observation, PatchId } from './schema.js';
import { applyCorrections, inScope } from './rules.js';

/**
 * The chore receipt compares the patches the user said they planned to clear with the final
 * rule-based actions (after context and corrections). It never invents a plan and never converts
 * grid cells into area, minutes, money, or ecological benefit.
 */
export type ReceiptBucket = 'reconsider' | 'keep_access' | 'inspect' | 'no_task';

export type ReceiptLine = {
  id: PatchId;
  intended: boolean;
  bucket: ReceiptBucket;
  decision: Pick<Decision, 'action' | 'ruleId' | 'title' | 'detail' | 'basis'>;
  original: Omit<Observation, 'id'>;
  final: Pick<Observation, 'surface' | 'material' | 'visibility'> & { siteConcern: boolean };
  /** Fields the user changed, with model value → user value. */
  changes: { field: 'surface' | 'material' | 'visibility' | 'siteConcern'; from: string; to: string }[];
};

export type Receipt = {
  intendedCount: number;
  /** Planned cleanup the rules suggest reconsidering (leave for now). */
  reconsider: ReceiptLine[];
  /** Access work that stays on the list, planned or not. */
  keepAccess: ReceiptLine[];
  /** Planned patches that need an on-site look before deciding. */
  inspect: ReceiptLine[];
  /** Planned patches where no fallen leaves were observed: no task, and not counted as work saved. */
  noTask: ReceiptLine[];
  /** Review patches the user did not plan to touch; listed so uncertainty is never hidden. */
  otherReview: PatchId[];
  context: Context;
  inScope: boolean;
};

const bucketOf = (d: Decision): ReceiptBucket =>
  d.action === 'leave' ? 'reconsider' : d.action === 'clear' ? 'keep_access' : d.action === 'review' ? 'inspect' : 'no_task';

export function buildReceipt(observations: Observation[], decisions: Decision[], corrections: Correction[], intended: PatchId[], ctx: Context): Receipt {
  const plan = new Set(intended);
  const eff = applyCorrections(observations, corrections);
  const lines = decisions.map((d, i): ReceiptLine => {
    const o = observations[i], e = eff[i];
    const changes: ReceiptLine['changes'] = [];
    if (e.corrected.surface) changes.push({ field: 'surface', from: o.surface, to: e.surface });
    if (e.corrected.material) changes.push({ field: 'material', from: o.material, to: e.material });
    if (e.corrected.visibility) changes.push({ field: 'visibility', from: o.visibility, to: e.visibility });
    if (e.corrected.siteConcern) changes.push({ field: 'siteConcern', from: 'false', to: String(e.siteConcern) });
    return {
      id: d.id,
      intended: plan.has(d.id),
      bucket: bucketOf(d),
      decision: { action: d.action, ruleId: d.ruleId, title: d.title, detail: d.detail, basis: d.basis },
      original: { surface: o.surface, material: o.material, visibility: o.visibility, evidence: o.evidence },
      final: { surface: e.surface, material: e.material, visibility: e.visibility, siteConcern: e.siteConcern },
      changes,
    };
  });
  const mine = lines.filter((l) => l.intended);
  return {
    intendedCount: mine.length,
    reconsider: mine.filter((l) => l.bucket === 'reconsider'),
    keepAccess: lines.filter((l) => l.bucket === 'keep_access'),
    inspect: mine.filter((l) => l.bucket === 'inspect'),
    noTask: mine.filter((l) => l.bucket === 'no_task'),
    otherReview: lines.filter((l) => !l.intended && l.bucket === 'inspect').map((l) => l.id),
    context: ctx,
    inScope: inScope(ctx),
  };
}
