/*
 * Card surfaces. GlowCard merges Aceternity's Glowing Effect + Card Spotlight into one
 * pointer-aware shell; Compare and CipherCard are reworked Compare / Evervault ideas.
 */
import { AnimatePresence, animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';

type GlowProps = { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' | 'section'; tone?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'children'>;

/** Card with a conic border light that tracks the pointer angle and a soft inner spotlight. */
export function GlowCard({ children, className, as = 'div', tone, ...rest }: GlowProps) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: RPointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    el.style.setProperty('--ang', `${(Math.atan2(y - r.height / 2, x - r.width / 2) * 180) / Math.PI + 90}deg`);
  };
  const Tag = as as 'div';
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={`glow-card ${tone ? `glow-${tone}` : ''} ${className ?? ''}`} onPointerMove={onMove} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
      <span className="glow-card-edge" aria-hidden />
      <span className="glow-card-spot" aria-hidden />
      {children}
    </Tag>
  );
}

/** Before/after slider. Drag, click, or use the arrow keys. Sweeps once when first seen. */
export function Compare({ before, after, beforeLabel = 'Before', afterLabel = 'After', className }: { before: ReactNode; after: ReactNode; beforeLabel?: string; afterLabel?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(55);
  const clip = useTransform(pos, (p) => `inset(0 ${100 - p}% 0 0)`);
  const left = useTransform(pos, (p) => `${p}%`);
  const [drag, setDrag] = useState(false);
  const [now, setNow] = useState(55);
  useMotionValueEvent(pos, 'change', (v) => setNow(Math.round(v)));
  const inView = useInView(ref, { once: true, margin: '-120px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(pos, [55, 82, 18, 50], { duration: 2.6, ease: 'easeInOut', delay: 0.3 });
    return () => c.stop();
  }, [inView, reduce, pos]);

  const setFrom = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    pos.set(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === 'ArrowLeft') { e.preventDefault(); pos.set(Math.max(0, pos.get() - step)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); pos.set(Math.min(100, pos.get() + step)); }
  };

  return (
    <div
      ref={ref}
      className={`compare ${drag ? 'dragging' : ''} ${className ?? ''}`}
      onPointerDown={(e) => { setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); setFrom(e.clientX); }}
      onPointerMove={(e) => { if (drag || e.pointerType === 'mouse') setFrom(e.clientX); }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <div className="compare-layer" inert>{after}</div>
      <motion.div className="compare-layer compare-before" style={{ clipPath: clip }} inert>{before}</motion.div>
      <span className="compare-tag compare-tag-l mono">{beforeLabel}</span>
      <span className="compare-tag compare-tag-r mono">{afterLabel}</span>
      <motion.div
        className="compare-handle"
        style={{ left }}
        role="slider"
        tabIndex={0}
        aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
        onKeyDown={onKey}
      >
        <span className="compare-knob"><span /><span /></span>
      </motion.div>
    </div>
  );
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123456789#%&*+=/<>';
const noise = (n: number) => Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');

/** Evervault-style card: a field of cipher text revealed in a pool of light under the pointer. */
export function CipherCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => noise(1600));
  const reduce = useReducedMotion();
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty('--cx', `${e.clientX - r.left}px`);
    ref.current!.style.setProperty('--cy', `${e.clientY - r.top}px`);
    if (!reduce) setText(noise(1600));
  };
  return (
    <div ref={ref} className={`cipher ${className ?? ''}`} onPointerMove={onMove}>
      <div className="cipher-text mono" aria-hidden>{text}</div>
      <div className="cipher-content">{children}</div>
    </div>
  );
}

/** A deck that deals its top card to the back on an interval (Card Stack, with depth blur). */
export function CardStack<T>({ items, render, interval = 3600, keyOf }: { items: T[]; render: (item: T) => ReactNode; interval?: number; keyOf: (item: T) => string }) {
  const [order, setOrder] = useState(items);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduce || paused) return;
    const i = setInterval(() => setOrder((o) => [...o.slice(1), o[0]]), interval);
    return () => clearInterval(i);
  }, [reduce, paused, interval]);
  return (
    <div className="stack" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <AnimatePresence initial={false}>
        {order.map((item, i) => (
          <motion.div
            key={keyOf(item)}
            className="stack-card"
            style={{ zIndex: order.length - i, transformOrigin: 'top center' }}
            animate={{ y: i * -12, scale: 1 - i * 0.06, opacity: i > 2 ? 0 : 1 - i * 0.18, filter: `blur(${i * 0.6}px)` }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            aria-hidden={i > 0}
          >
            {render(item)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
