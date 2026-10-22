import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ModelStatus, type HealthState } from './ModelStatus';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#try', label: 'Try it' },
  { href: '#rules', label: 'How it decides' },
  { href: '#limits', label: 'Limits' },
];

export function LeafMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="leafmark">
      <defs>
        <linearGradient id="lm" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff7a2f" /><stop offset="1" stopColor="#ffb347" /></linearGradient>
      </defs>
      <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="url(#lm)" />
      <path d="M4 20 13 11" stroke="#0b0a08" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Floating pill nav that tightens on scroll; a lit pill follows the hovered or current link. */
export function Nav({ health }: { health: HealthState }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 30));

  useEffect(() => {
    const ids = LINKS.map((l) => l.href.slice(1));
    const io = new IntersectionObserver(
      (es) => { for (const e of es) if (e.isIntersecting) setActive(`#${e.target.id}`); },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const lit = hover ?? active;
  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <motion.div className="nav-shell" layout transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
        <a href="#top" className="brand" aria-label="RakeLess home">
          <LeafMark />
          <span>Rake<em>Less</em></span>
        </a>
        <nav aria-label="Sections" onPointerLeave={() => setHover(null)}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onPointerEnter={() => setHover(l.href)} aria-current={active === l.href ? 'true' : undefined} className={lit === l.href ? 'lit' : ''}>
              {lit === l.href && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span>{l.label}</span>
            </a>
          ))}
        </nav>
        <div className="nav-end">
          <ModelStatus health={health} />
          <a href="#try" className="nav-cta">Try it <ArrowUpRight size={15} aria-hidden /></a>
        </div>
      </motion.div>
    </header>
  );
}
