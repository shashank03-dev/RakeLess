/* Segmented control with a sliding active pill (Aceternity Tabs, as a radio group). */
import { motion } from 'motion/react';
import type { KeyboardEvent } from 'react';

export type SegOption<T extends string> = { v: T; label: string };

export function Segmented<T extends string>({ name, label, labelledBy, value, options, onChange, userValue, size = 'md' }: {
  name: string;
  label?: string;
  labelledBy?: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  /** The value the user set explicitly, shown with the "you" tint. */
  userValue?: T;
  size?: 'sm' | 'md';
}) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].v);
    (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className={`segmented seg-${size}`} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const on = value === o.v;
        return (
          <button key={o.v} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            className={`seg-opt ${on ? 'on' : ''} ${on && userValue === o.v ? 'user' : ''}`}
            onClick={() => onChange(o.v)} onKeyDown={(e) => onKey(e, i)}>
            {on && <motion.span layoutId={`seg-${name}`} className="seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="seg-text">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
