import type { Context, Correction, Decision, Observation, PatchId } from './schema.js';

export const RULES_VERSION = 'rules-2026-10-22.2';

export type EffectiveObservation = Observation & {
  corrected: { surface: boolean; material: boolean; visibility: boolean; siteConcern: boolean };
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
      visibility: c?.visibility ?? o.visibility,
      siteConcern: c?.siteConcern ?? false,
      corrected: {
        surface: c?.surface !== undefined,
        material: c?.material !== undefined,
        visibility: c?.visibility !== undefined,
        siteConcern: c?.siteConcern !== undefined,
      },
    };
  });
}

const has = (o: EffectiveObservation) => o.material === 'fallen_leaves';

/** True when the observation is not clear enough to act on without looking. */
export function isUncertain(o: Pick<Observation, 'surface' | 'material' | 'visibility'>) {
  return o.visibility === 'unclear' || o.material === 'mixed_or_unclear' || o.surface === 'mixed' || o.surface === 'unknown';
}

/**
 * Pure, ordered rules. Observations in, conservative suggestions out.
 * The same code runs on the server and in the browser for corrections.
 *
 * Order matters and is tested (tests/rules.test.ts):
 *   R2 scope → R8a nothing on the ground (seen clearly) → R5 uncertainty → R3 access route
 *   → R4 site concerns → R6 beds → R7 lawn → R9 fallback review.
 * Uncertainty runs before the path rule: an unclear "path" is routed to inspection, not to a chore.
 */
export function decide(observations: Observation[], ctx: Context, corrections: Correction[] = []): Decision[] {
  if (observations.length !== 9) throw new Error('A plan needs exactly nine observations.');
  return applyCorrections(observations, corrections).map((o) => decideOne(o, ctx));
}

function decideOne(o: EffectiveObservation, ctx: Context): Decision {
  const c = o.corrected;
  const basis = c.surface || c.material || c.visibility || c.siteConcern ? 'user' : 'model';
  const d = (action: Decision['action'], ruleId: string, title: string, detail: string, sourceIds: string[]): Decision => ({
    id: o.id, action, title, detail, ruleId, sourceIds, basis,
  });
  // "Nothing to rake" needs a clear view of bare ground (or of no ground at all, e.g. canopy) and no flagged concern.
  const noLeaves = o.material === 'no_relevant_leaves' && o.visibility === 'clear' && !o.siteConcern;

  // R2 — outside the supported region/season: no automatic ecology advice.
  if (!inScope(ctx)) {
    if (noLeaves) return d('none', 'R8', 'No leaf task', 'No fallen leaves were observed here.', []);
    return d('review', 'R2', 'Review on site', 'Outside the temperate North American autumn scope these rules were written for. RakeLess will not suggest leaving or clearing here.', ['cleanup']);
  }

  // R8 (early) — clearly no leaves on the ground: nothing to do, whatever the surface.
  if (noLeaves) return d('none', 'R8', 'No leaf task', 'No fallen leaves on the ground were observed here.', []);

  // R5 — uncertainty governs the categorical decision, including on possible paths.
  if (isUncertain(o)) {
    const reasons = [
      o.visibility === 'unclear' && 'the ground is not clearly visible in the photo',
      o.material === 'mixed_or_unclear' && 'it is unclear whether leaves are on the ground',
      o.surface === 'mixed' && 'the patch mixes surfaces (for example lawn and bed), so one action cannot fit all of it',
      o.surface === 'unknown' && 'the surface could not be identified',
    ].filter(Boolean) as string[];
    const why = reasons.length ? `Review because ${reasons.join('; ')}.` : 'Review because the observation is uncertain.';
    if (o.surface === 'path_or_steps') {
      return d('review', 'R5', 'Inspect this possible access route', `${why} If it is a path or steps you use, keep it clear; confirm it in the inspector once you have looked.`, ['cleanup', 'cues']);
    }
    return d('review', 'R5', 'Review closely', `${why} Look at it in person before deciding.`, ['cleanup']);
  }

  // R3 — access routes with leaves, seen clearly. Still a suggestion, not a safety check.
  if (o.surface === 'path_or_steps' && has(o)) {
    return c.surface
      ? d('clear', 'R3', 'Clear leaves from this access route', 'You confirmed this is a path or steps. Keep it usable; a kept path is also a visible cue that the rest is intentional.', ['cues'])
      : d('clear', 'R3', 'Check and clear leaves from this access route', 'This looks like a path or steps to the model. Check it on site; this is a suggestion, not a safety certification.', ['cues']);
  }

  // R4 — known disease/site concerns, or unresolved context.
  if (o.siteConcern || ctx.concerns !== 'none') {
    const why = o.siteConcern
      ? 'You marked a site concern for this patch.'
      : ctx.concerns === 'yes'
        ? 'You reported plant disease, fire restrictions, or another site concern.'
        : 'Site concerns are unresolved. Answer the site question to unlock leave-alone suggestions.';
    return d('review', 'R4', 'Review closely', `${why} RakeLess gives no disposal or burning advice.`, ['cleanup']);
  }

  // R6 — leaves on beds / tree bases.
  if (o.surface === 'bed_or_tree_base' && has(o)) {
    return d('leave', 'R6', 'Leave for now', 'Consider leaving these fallen leaves in place. This is a photo-based suggestion: walk the patch first, and it says nothing about leaf depth, plant health, or local rules.', ['habitat', 'cleanup']);
  }

  // R7 — leaves on lawn.
  if (o.surface === 'lawn' && has(o)) {
    return d('review', 'R7', 'Review the lawn', 'A photo cannot show leaf depth. A light layer can be mulched in; a thick mat can smother turf.', ['turf', 'cleanup']);
  }

  // R9 — anything the rules above do not cover is never silently dropped.
  return d('review', 'R9', 'Review closely', 'No rule covers this combination, so RakeLess makes no suggestion. Look at it in person.', ['cleanup']);
}

export function summarize(decisions: Decision[]) {
  const count = (a: Decision['action']) => decisions.filter((x) => x.action === a).length;
  return { leave: count('leave'), clear: count('clear'), review: count('review'), none: count('none') };
}
