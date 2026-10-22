import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Decision } from '../../shared/schema';
import { ACTION_META } from '../lib/actions';

/**
 * The before/after: a naive "rake every leafy patch" list, then the plan.
 * Only patches that had leaves (or were unclear) start as chores — no invented savings.
 */
export function ChoreLedger({ decisions, play = true }: { decisions: Decision[]; play?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(!!reduce);
  const chores = decisions.filter((d) => d.action !== 'none');

  useEffect(() => {
    if (reduce || !play) { setSettled(true); return; }
    if (!inView) return;
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, [inView, reduce, play, decisions]);

  return (
    <div ref={ref} className="ledger">
      <div className="ledger-head">
        <span className="mono">To do · raking</span>
        <span className="mono">{settled ? `${chores.filter((c) => c.action !== 'leave').length} left` : `${chores.length} planned`}</span>
      </div>
      <ul>
        {chores.map((d, i) => {
          const cancelled = settled && d.action === 'leave';
          const meta = ACTION_META[d.action];
          return (
            <li key={d.id} className={`ledger-row ${cancelled ? 'cancelled' : ''}`}>
              <span className="mono pid">{d.id}</span>
              <span className="ledger-text">
                Rake patch {d.id}
                <motion.span className="strike" initial={false} animate={{ scaleX: cancelled ? 1 : 0 }} transition={{ duration: 0.45, delay: reduce ? 0 : i * 0.12, ease: [0.6, 0, 0.2, 1] }} />
              </span>
              <motion.span className={`ledger-tag tone-${meta.tone}`} initial={false} animate={{ opacity: settled ? 1 : 0, x: settled ? 0 : -6 }} transition={{ delay: reduce ? 0 : 0.25 + i * 0.12 }}>
                <meta.Icon size={12} aria-hidden /> {d.action === 'leave' ? 'can wait' : d.action === 'clear' ? 'still do' : 'check first'}
              </motion.span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
