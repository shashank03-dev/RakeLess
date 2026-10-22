import { AnimatePresence, motion } from 'motion/react';
import type { Decision, PatchId } from '../../shared/schema';
import { ACTION_META } from '../lib/actions';

const ORDER = ['clear', 'review', 'leave', 'none'] as const;

export function ActionList({ decisions, selected, onSelect }: { decisions: Decision[]; selected: PatchId | null; onSelect: (id: PatchId) => void }) {
  return (
    <div className="actions">
      {ORDER.map((a) => {
        const items = decisions.filter((d) => d.action === a);
        const meta = ACTION_META[a];
        return (
          <section key={a} className={`group tone-${meta.tone}`} aria-label={meta.label}>
            <h4 className="group-head">
              <span className={`swatch act-${a}`} aria-hidden><meta.Icon size={12} /></span>
              {meta.label}
              <span className="mono count">{items.length}</span>
            </h4>
            <ul>
              <AnimatePresence initial={false}>
                {items.map((d) => (
                  <motion.li key={d.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                    <button type="button" className={`action-row ${selected === d.id ? 'on' : ''}`} onClick={() => onSelect(d.id)} aria-label={`${d.id}: ${d.title}`}>
                      <span className="mono pid">{d.id}</span>
                      <span className="action-title">{d.title}</span>
                      {d.basis === 'user' && <span className="badge-user">you</span>}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {items.length === 0 && <li className="empty">None</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
