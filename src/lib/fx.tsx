/* Small interaction primitives, in the spirit of React Bits, written for this app. */
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react';

/** Headline that rises in word by word. */
export function SplitWords({ text, className, delay = 0, italic = [] as string[] }: { text: string; className?: string; delay?: number; italic?: string[] }) {
  const reduce = useReducedMotion();
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="split-word" aria-hidden>
          <motion.span
            style={{ display: 'inline-block' }}
            className={italic.includes(w.replace(/[^\w]/g, '')) ? 'em' : undefined}
            initial={reduce ? false : { y: '105%', opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: delay + i * 0.06, ease: [0.2, 0.7, 0.1, 1] }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Button content that leans toward the cursor. */
export function Magnet({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });
  const onMove = (e: RPointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  return (
    <motion.span className={`magnet ${className ?? ''}`} style={{ x, y }} onPointerMove={onMove} onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.span>
  );
}

/** Number that counts to its value when visible, and re-counts when it changes. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const shown = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const paint = (v: number) => { shown.current = v; if (ref.current) ref.current.textContent = String(Math.round(v)); };
    if (reduce) { paint(value); return; }
    const c = animate(shown.current, value, { duration: 0.9, ease: 'easeOut', onUpdate: paint });
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className={className}>0</span>;
}

/** Fade/rise into view once. */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M className={className} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.1, 1] }}>
      {children}
    </M>
  );
}

/** Card with a soft light that follows the pointer. */
export function Spotlight({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} className={`spotlight ${className ?? ''}`} onPointerMove={onMove} {...rest}>
      {children}
    </div>
  );
}

/** Gentle 3D tilt toward the pointer. */
export function Tilt({ children, className, max = 5 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 150, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 150, damping: 20 });
  return (
    <motion.div
      className={className}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { px.set(0.5); py.set(0.5); }}
    >
      {children}
    </motion.div>
  );
}

/** Little burst of leaves from a point — fired when a chore is cancelled. */
export function useLeafBurst() {
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const reduce = useReducedMotion();
  const fire = (x: number, y: number) => {
    if (reduce) return;
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 900);
  };
  const layer = (
    <div className="burst-layer" aria-hidden>
      {bursts.map((b) => (
        <div key={b.id} className="burst" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
            const d = 34 + Math.random() * 26;
            return (
              <motion.svg key={i} viewBox="0 0 12 12" width="12" height="12" className="burst-leaf"
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 14, opacity: 0, rotate: (Math.random() - 0.5) * 260, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}>
                <path d="M1 11C1 5 4.5 1.5 11 1c-.5 6.5-4 10-10 10Z" fill={i % 2 ? '#C9822F' : '#7A8F4E'} />
              </motion.svg>
            );
          })}
        </div>
      ))}
    </div>
  );
  return { fire, layer };
}

/** A strip of words whose speed follows scroll velocity. */
export function VelocityMarquee({ items }: { items: string[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduce) return;
    let x = 0, last = window.scrollY, v = 0, raf = 0;
    const tick = () => {
      const s = window.scrollY;
      v = v * 0.9 + (s - last) * 0.1;
      last = s;
      x -= 0.5 + Math.abs(v) * 0.6;
      const el = ref.current;
      if (el) {
        const half = el.scrollWidth / 2;
        if (-x > half) x += half;
        el.style.transform = `translate3d(${x}px,0,0) skewX(${Math.max(-8, Math.min(8, -v * 0.4))}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  const row = [...items, ...items];
  return (
    <div className="marquee" aria-hidden>
      <div ref={ref} className="marquee-track">
        {row.map((t, i) => (
          <span key={i} className="marquee-item">{t}<svg className="marquee-dot" viewBox="0 0 12 12" width="14" height="14"><path d="M1 11C1 5 4.5 1.5 11 1c-.5 6.5-4 10-10 10Z" fill="currentColor" /></svg></span>
        ))}
      </div>
    </div>
  );
}
