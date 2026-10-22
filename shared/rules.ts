import type { Context, Correction, Decision, Observation, PatchId } from './schema';

export const RULES_VERSION = 'rules-2026-10-22.1';

export type EffectiveObservation = Observation & {
  corrected: { surface: boolean; material: boolean; siteConcern: boolean };
  siteConcern: boolean;
};

export function inScope(ctx: Context) {
  return ctx.region === 'temperate_na' && ctx.season === 'autumn';
}

export function applyCorrections(observations: Observation[], corrections: Correction[]): EffectiveObservation[] {
  const byId = new Map<PatchId, Correction>(corrections.map((c) => [c.id, c]));
  return observations.map((o) => {
    const c = byId.get(o.id);
    return {
      ...o,
      surface: c?.surface ?? o.surface,
      material: c?.material ?? o.material,
      siteConcern: c?.siteConcern ?? false,
      corrected: {
        surface: c?.surface !== undefined,
        material: c?.material !== undefined,
        siteConcern: c?.siteConcern !== undefined,
      },
    };
  });
}

const has = (o: EffectiveObservation) => o.material === 'fallen_leaves';

/**
 * Pure, ordered rules. Observations in, conservative suggestions out.
 * The same code runs on the server and in the browser for corrections.
 */
export function decide(observations: Observation[], ctx: Context, corrections: Correction[] = []): Decision[] {
  if (observations.length !== 9) throw new Error('A plan needs exactly nine observations.');
  return applyCorrections(observations, corrections).map((o) => decideOne(o, ctx));
}

function decideOne(o: EffectiveObservation, ctx: Context): Decision {
  const basis = o.corrected.surface || o.corrected.material || o.corrected.siteConcern ? 'user' : 'model';
  const d = (action: Decision['action'], ruleId: string, title: string, detail: string, sourceIds: string[]): Decision => ({
    id: o.id, action, title, detail, ruleId, sourceIds, basis,
  });
  const noLeaves = o.material === 'no_relevant_leaves' && o.visibility === 'clear' && !o.siteConcern;

  // R2 — outside the supported region/season: no automatic ecology advice.
  if (!inScope(ctx)) {
    if (noLeaves) return d('none', 'R8', 'No leaf task', 'No fallen leaves were observed here.', []);
    return d('review', 'R2', 'Review on site', 'Outside the temperate North American autumn scope these rules were written for. RakeLess will not suggest leaving or clearing here.', ['cleanup']);
  }

  // R3 — access routes with leaves.
  if (o.surface === 'path_or_steps' && has(o)) {
    return o.corrected.surface
      ? d('clear', 'R3', 'Clear leaves from this access route', 'You confirmed this is a path or steps. Keep it usable; a kept path is also a visible cue that the rest is intentional.', ['cues'])
      : d('clear', 'R3', 'Check and clear leaves from this access route', 'This looks like a path or steps to the model. Check it on site; this is a suggestion, not a safety certification.', ['cues']);
  }

  // R4 — known disease/site concerns, or unresolved context.
  if (o.siteConcern || ctx.concerns !== 'none') {
    if (noLeaves) return d('none', 'R8', 'No leaf task', 'No fallen leaves were observed here.', []);
    const why = o.siteConcern
      ? 'You marked a site concern for this patch.'
      : ctx.concerns === 'yes'
        ? 'You reported plant disease, fire restrictions, or another site concern.'
        : 'Site concerns are unresolved. Answer the site question to unlock leave-alone suggestions.';
    return d('review', 'R4', 'Review closely', `${why} RakeLess gives no disposal or burning advice.`, ['cleanup']);
  }

  // R8 (early) — clearly no leaves on the ground: nothing to do, whatever the surface.
  if (noLeaves) return d('none', 'R8', 'No leaf task', 'No fallen leaves on the ground were observed here.', []);

  // R5 — anything unclear or mixed.
  if (o.visibility === 'unclear' || o.surface === 'mixed' || o.surface === 'unknown' || o.material === 'mixed_or_unclear') {
    return d('review', 'R5', 'Review closely', 'The photo does not show this patch clearly enough, or it mixes surfaces. Look at it in person.', ['cleanup']);
  }

  // R6 — leaves on beds / tree bases.
  if (o.surface === 'bed_or_tree_base' && has(o)) {
    return d('leave', 'R6', 'Leave for now', 'Consider leaving these fallen leaves in place; inspect the patch first.', ['habitat', 'cleanup']);
  }

  // R7 — leaves on lawn.
  if (o.surface === 'lawn' && has(o)) {
    return d('review', 'R7', 'Review the lawn', 'A photo cannot show leaf depth. A light layer can be mulched in; a thick mat can smother turf.', ['turf']);
  }

  // R8 — nothing to do.
  return d('none', 'R8', 'No leaf task', 'No fallen leaves were observed here.', []);
}

export function summarize(decisions: Decision[]) {
  const count = (a: Decision['action']) => decisions.filter((x) => x.action === a).length;
  return { leave: count('leave'), clear: count('clear'), review: count('review'), none: count('none') };
}
