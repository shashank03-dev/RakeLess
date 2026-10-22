import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { gridRegions, regionPercent } from '../../shared/grid';
import { PATCH_IDS, type Decision, type PatchId } from '../../shared/schema';
import type { EffectiveObservation } from '../../shared/rules';
import { ACTION_META } from '../lib/actions';

type Props = {
  src: string;
  width: number;
  height: number;
  decisions: Decision[];
  effective: EffectiveObservation[];
  selected: PatchId | null;
  onSelect: (id: PatchId) => void;
  revealKey?: string;
  compact?: boolean;
  scanning?: boolean;
};

export function PhotoMap({ src, width, height, decisions, effective, selected, onSelect, revealKey, compact, scanning }: Props) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  const regions = gridRegions(width, height);
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const effById = new Map(effective.map((o) => [o.id, o]));

  const onKey = (e: KeyboardEvent, id: PatchId) => {
    const i = PATCH_IDS.indexOf(id);
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    if (!(e.key in moves)) return;
    const n = i + moves[e.key];
    if (n < 0 || n > 8 || (Math.abs(moves[e.key]) === 1 && Math.floor(n / 3) !== Math.floor(i / 3))) return;
    e.preventDefault();
    onSelect(PATCH_IDS[n]);
    wrap.current?.querySelectorAll<HTMLButtonElement>('.cell')[n]?.focus();
  };

  return (
    <div
      ref={wrap}
      className={`photomap ${compact ? 'compact' : ''} ${scanning ? 'scanning' : ''}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerMove={(e) => {
        if (compact || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        setLoupe({ x: e.clientX - r.left, y: e.clientY - r.top });
        e.currentTarget.style.setProperty('--lx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--ly', `${e.clientY - r.top}px`);
      }}
      onPointerLeave={() => setLoupe(null)}
    >
      <img src={src} alt="The analyzed photograph" className="photomap-img" draggable={false} />
      <div className="photomap-light" aria-hidden />
      {scanning && <div className="scanline" aria-hidden />}
      <div className="cells" role="group" aria-label="Photo patches A1 to C3">
        {regions.map((r, i) => {
          const p = regionPercent(r, width, height);
          const d = byId.get(r.id);
          const o = effById.get(r.id);
          const meta = d ? ACTION_META[d.action] : null;
          const userSet = o && (o.corrected.surface || o.corrected.material || o.corrected.siteConcern);
          return (
            <motion.button
              key={`${r.id}-${revealKey}`}
              type="button"
              className={`cell ${d ? `act-${d.action}` : 'pending'} ${selected === r.id ? 'selected' : ''}`}
              style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }}
              aria-label={`${r.id}: ${meta ? meta.label.toLowerCase() : 'not analyzed'}${userSet ? ', corrected by you' : ''}`}
              aria-pressed={selected === r.id}
              tabIndex={selected ? (selected === r.id ? 0 : -1) : i === 0 ? 0 : -1}
              onClick={() => onSelect(r.id)}
              onKeyDown={(e) => onKey(e, r.id)}
              initial={reduce || !d ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.02 }}
            >
              <span className="cell-tag">
                <span className="cell-id">{r.id}</span>
                {meta && (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={d!.action} className="cell-act" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.18 }}>
                      <meta.Icon size={13} strokeWidth={2.2} aria-hidden />
                      {!compact && <span className="cell-act-label">{meta.short}</span>}
                    </motion.span>
                  </AnimatePresence>
                )}
                {userSet && !compact && <span className="cell-user" title="Corrected by you">you</span>}
              </span>
            </motion.button>
          );
        })}
      </div>
      {loupe && !reduce && (
        <div
          className="loupe"
          aria-hidden
          style={{
            left: loupe.x,
            top: loupe.y,
            backgroundImage: `url(${src})`,
            backgroundSize: `${(wrap.current?.clientWidth ?? 0) * 2.4}px auto`,
            backgroundPosition: `${-loupe.x * 2.4 + 70}px ${-loupe.y * 2.4 + 70}px`,
          }}
        />
      )}
    </div>
  );
}

/** Actual crop of one patch, using the same geometry as the overlay. */
export function PatchCrop({ src, width, height, id }: { src: string; width: number; height: number; id: PatchId }) {
  const r = gridRegions(width, height).find((x) => x.id === id)!;
  return (
    <div className="crop" style={{ aspectRatio: `${r.width} / ${r.height}` }} role="img" aria-label={`Crop of patch ${id}`}>
      <img
        src={src}
        alt=""
        style={{ width: `${(width / r.width) * 100}%`, left: `${(-r.left / r.width) * 100}%`, top: `${(-r.top / r.height) * 100}%` }}
      />
    </div>
  );
}
