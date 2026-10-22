import { CircleHelp, Footprints, Leaf, Minus, type LucideIcon } from 'lucide-react';
import type { Action, Material, Surface } from '../../shared/schema';
import type { Run } from './api';

export const ACTION_META: Record<Action, { label: string; short: string; Icon: LucideIcon; tone: string }> = {
  leave: { label: 'Leave for now', short: 'Leave', Icon: Leaf, tone: 'moss' },
  clear: { label: 'Clear access', short: 'Clear', Icon: Footprints, tone: 'brick' },
  review: { label: 'Review closely', short: 'Review', Icon: CircleHelp, tone: 'amber' },
  none: { label: 'No leaf task', short: 'None', Icon: Minus, tone: 'stone' },
};

export const SURFACE_LABEL: Record<Surface, string> = {
  bed_or_tree_base: 'Bed / tree base',
  lawn: 'Lawn',
  path_or_steps: 'Path / steps',
  mixed: 'Mixed',
  unknown: 'Unknown',
};

export const MATERIAL_LABEL: Record<Material, string> = {
  fallen_leaves: 'Fallen leaves',
  no_relevant_leaves: 'No leaves on ground',
  mixed_or_unclear: 'Unclear',
};

/** One unambiguous label per result: replay, fresh, cached, hosted, or local are never conflated. */
export function runKindLabel(run: Run) {
  const p = run.provenance;
  if (p.mode === 'recorded') return `RECORDED REPLAY · not a new model call`;
  if (p.mode === 'evaluation') return 'EVALUATION RUN';
  const where = p.localInference ? 'LOCAL' : 'HOSTED';
  return p.cacheHit ? `${where} · CACHED (no new model call)` : `${where} · LIVE MODEL CALL`;
}
