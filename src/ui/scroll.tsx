/*
 * Scroll-linked pieces: Container Scroll Animation (a stage that tilts flat as you scroll),
 * Tracing Beam, and Infinite Moving Cards — reworked with springs and edge fades.
 */
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

/** Content laid back in 3D that rises and flattens as it scrolls into place. */
export function ScrollStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.18'] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const rotateX = useTransform(p, [0, 1], [26, 0]);
  const scale = useTransform(p, [0, 1], [0.9, 1]);
  const y = useTransform(p, [0, 1], [40, 0]);
  const glow = useTransform(p, [0, 1], [0.25, 1]);
  return (
    <div ref={ref} className={`stage ${className ?? ''}`}>
      <motion.div className="stage-glow" style={reduce ? undefined : { opacity: glow }} aria-hidden />
      <motion.div className="stage-body" style={reduce ? undefined : { rotateX, scale, y, transformPerspective: 1400 }}>
        {children}
      </motion.div>
    </div>
  );
}

/** A rail beside content whose light fills as you read down it. */
export function TracingBeam({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });
  const top = useTransform(fill, (v) => `${v * 100}%`);
  return (
    <div ref={ref} className={`trace ${className ?? ''}`}>
      <div className="trace-rail" aria-hidden>
        <motion.div className="trace-fill" style={{ scaleY: fill }} />
        <motion.div className="trace-dot" style={{ top }} />
      </div>
      <div className="trace-body">{children}</div>
    </div>
  );
}

/** Endless strip of cards with faded edges; pauses on hover or focus. */
export function InfiniteCards({ children, speed = 40, reverse, label }: { children: ReactNode[]; speed?: number; reverse?: boolean; label: string }) {
  return (
    <div className="infinite" role="region" aria-label={label}>
      <ul className={`infinite-track ${reverse ? 'rev' : ''}`} style={{ ['--dur' as string]: `${speed}s` }}>
        {children.map((c, i) => <li key={`a${i}`}>{c}</li>)}
        {children.map((c, i) => <li key={`b${i}`} aria-hidden inert>{c}</li>)}
      </ul>
    </div>
  );
}
