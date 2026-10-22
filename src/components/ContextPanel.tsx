import { AnimatePresence, motion } from 'motion/react';
import type { Context } from '../../shared/schema';
import { inScope } from '../../shared/rules';
import { Segmented } from '../ui/Segmented';

const note = { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } };

export function ContextPanel({ ctx, onChange }: { ctx: Context; onChange: (c: Context) => void }) {
  return (
    <div className="ctx">
      <div className="ctx-q">
        <div className="ctx-label" id="concerns-l">Any known plant disease, local fire restrictions, or other site concerns?</div>
        <Segmented name="concerns" labelledBy="concerns-l" value={ctx.concerns}
          options={[{ v: 'none', label: 'None known' }, { v: 'yes', label: 'Yes' }, { v: 'not_sure', label: 'Not sure' }]}
          onChange={(concerns) => onChange({ ...ctx, concerns })} />
      </div>
      <AnimatePresence initial={false}>
        {ctx.concerns !== 'none' && (
          <motion.p key="c" className="ctx-note" {...note}>Until this is “None known”, RakeLess won’t suggest leaving any leaves. Paths can still be flagged.</motion.p>
        )}
      </AnimatePresence>
      <div className="ctx-row">
        <div className="ctx-q">
          <div className="ctx-label" id="region-l">Where is this?</div>
          <Segmented name="region" labelledBy="region-l" value={ctx.region}
            options={[{ v: 'temperate_na', label: 'Temperate N. America' }, { v: 'other', label: 'Elsewhere' }, { v: 'unsure', label: 'Not sure' }]}
            onChange={(region) => onChange({ ...ctx, region })} />
        </div>
        <div className="ctx-q">
          <div className="ctx-label" id="season-l">Season</div>
          <Segmented name="season" labelledBy="season-l" value={ctx.season}
            options={[{ v: 'autumn', label: 'Autumn' }, { v: 'other', label: 'Other' }]}
            onChange={(season) => onChange({ ...ctx, season })} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!inScope(ctx) && <motion.p key="s" className="ctx-note warn" {...note}>Outside the rules’ scope: you can view the map, but every leafy patch becomes review-only.</motion.p>}
      </AnimatePresence>
    </div>
  );
}
