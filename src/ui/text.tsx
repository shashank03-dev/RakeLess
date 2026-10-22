/*
 * Type effects, reworked from Aceternity's Text Generate, Flip Words, Encrypted Text,
 * Typewriter and Text Hover Effect.
 */
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** Headline that rises in word by word out of a blur. Words in `accent` get the serif italic. */
export function SplitWords({ text, className, delay = 0, accent = [] as string[] }: { text: string; className?: string; delay?: number; accent?: string[] }) {
  const reduce = useReducedMotion();
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="split-word" aria-hidden>
          <motion.span
            style={{ display: 'inline-block' }}
            className={accent.includes(w.replace(/[^\w]/g, '')) ? 'accent' : undefined}
            initial={reduce ? false : { y: '70%', opacity: 0, filter: 'blur(12px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: delay + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** A word that flips through a list; its container eases to each word's width. */
export function FlipWords({ words, interval = 2400, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [reduce, interval, words.length]);
  const w = words[i];
  return (
    <motion.span layout className={`flip ${className ?? ''}`} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <span className="sr-only">{words.join(', ')}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={w} className="flip-word" aria-hidden
          initial={{ opacity: 0, y: '0.5em', filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.5em', filter: 'blur(8px)', position: 'absolute' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
          {w.split('').map((c, k) => (
            <motion.span key={k} style={{ display: 'inline-block', whiteSpace: 'pre' }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.025, duration: 0.3 }}>
              {c}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

const GLYPHS = '#%&*+=/<>0123456789abcdefghijklmnopqrstuvwxyz';

/** Text that resolves out of random glyphs when it scrolls into view (and again on hover). */
export function Scramble({ text, className, delay = 0, speed = 24 }: { text: string; className?: string; delay?: number; speed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce || (!inView && run === 0)) return;
    let frame = 0, timer = 0;
    const total = text.length;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        frame++;
        const solved = frame;
        setOut(text.split('').map((c, k) => (c === ' ' || k < solved ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
        if (solved >= total) { clearInterval(timer); setOut(text); }
      }, speed);
    }, run === 0 ? delay * 1000 : 0);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [inView, run, text, reduce, delay, speed]);

  return (
    <span ref={ref} className={className} aria-label={text} onPointerEnter={() => setRun((n) => n + 1)}>
      <span aria-hidden>{inView || reduce ? out : text.replace(/\S/g, ' ')}</span>
    </span>
  );
}

/** Types lines out like a terminal, then waits and starts over. */
export function Typewriter({ lines, className }: { lines: { text: string; cls?: string }[]; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const inView = useInView(ref, { margin: '-40px' });
  const reduce = useReducedMotion();
  const full = lines.reduce((n, l) => n + l.text.length + 1, 0);
  const [n, setN] = useState(reduce ? full : 0);
  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(() => setN((x) => (x >= full + 60 ? 0 : x + 1)), n < full ? 26 : 50);
    return () => clearTimeout(t);
  }, [n, inView, reduce, full]);
  let left = n;
  let caretPlaced = false;
  return (
    <pre ref={ref} className={`typer mono ${className ?? ''}`} aria-label={lines.map((l) => l.text).join('\n')}>
      <code aria-hidden>
        {lines.map((l, i) => {
          const shown = l.text.slice(0, Math.max(0, left));
          const caret = !caretPlaced && left <= l.text.length;
          if (caret) caretPlaced = true;
          left -= l.text.length + 1;
          return (
            <span key={i} className={l.cls}>
              {shown}
              {caret && <span className="caret" />}
              {'\n'}
            </span>
          );
        })}
        {!caretPlaced && <span className="caret" />}
      </code>
    </pre>
  );
}

/** A giant outlined wordmark: it draws itself in, and a warm gradient follows the pointer. */
export function Wordmark({ text = 'RakeLess' }: { text?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [p, setP] = useState({ x: 50, y: 50, on: false });
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  return (
    <svg
      ref={ref}
      className="wordmark-svg"
      viewBox="0 0 1000 200"
      aria-hidden
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setP({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, on: true }); }}
      onPointerLeave={() => setP((q) => ({ ...q, on: false }))}
    >
      <defs>
        <linearGradient id="wm-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="35%" stopColor="#ff7a2f" />
          <stop offset="65%" stopColor="#a6d86a" />
          <stop offset="100%" stopColor="#f6b84b" />
        </linearGradient>
        <motion.radialGradient id="wm-reveal" gradientUnits="userSpaceOnUse" r="22%" animate={{ cx: `${p.x}%`, cy: `${p.y}%` }} transition={{ duration: 0.25 }}>
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="wm-mask"><rect x="0" y="0" width="100%" height="100%" fill="url(#wm-reveal)" /></mask>
      </defs>
      <motion.text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="wm-outline"
        initial={reduce ? false : { strokeDashoffset: 1200, strokeDasharray: 1200 }}
        animate={inView ? { strokeDashoffset: 0, strokeDasharray: 1200 } : undefined}
        transition={{ duration: 3.2, ease: 'easeInOut' }}>
        {text}
      </motion.text>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="wm-glow" stroke="url(#wm-grad)" mask="url(#wm-mask)" style={{ opacity: p.on ? 1 : 0 }}>
        {text}
      </text>
    </svg>
  );
}
