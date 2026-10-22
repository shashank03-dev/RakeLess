/*
 * Background layers, inspired by Aceternity's Dotted Glow, Background Ripple,
 * Sparkles and Spotlight — rebuilt here as canvas/CSS pieces with an autumn twist.
 */
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const LEAF = 'M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z';

/** Runs `draw` every frame while the canvas is on screen and the tab is visible. */
function useCanvasLoop(
  ref: React.RefObject<HTMLCanvasElement | null>,
  setup: (w: number, h: number) => void,
  draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void,
  still: boolean,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, visible = true;
    const t0 = performance.now();
    const size = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setup(w, h);
      if (still) draw(ctx, 0, w, h);
    };
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(ctx, (now - t0) / 1000, w, h);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!still && !raf) raf = requestAnimationFrame(frame); };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(canvas);
    const onVis = () => start();
    document.addEventListener('visibilitychange', onVis);
    size();
    start();
    return () => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(raf); };
  }, [still]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Dot-matrix field with a giant leaf drawn in lit dots. The pointer warms the dots
 * near it and a click sends a ripple through the grid.
 */
export function DotField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = !!useReducedMotion();
  const state = useRef({ dots: [] as { x: number; y: number; leaf: number; vein: boolean }[], px: -9999, py: -9999, ripples: [] as { x: number; y: number; t: number }[], t: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      state.current.px = e.clientX - r.left;
      state.current.py = e.clientY - r.top;
    };
    const down = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      const s = state.current;
      s.ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: s.t });
      if (s.ripples.length > 4) s.ripples.shift();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); };
  }, [reduce]);

  useCanvasLoop(
    ref,
    (w, h) => {
      const gap = w < 640 ? 13 : 16;
      const probe = document.createElement('canvas').getContext('2d')!;
      const leaf = new Path2D(LEAF);
      const scale = Math.min(w * 0.042, h * 0.05);
      const cx = w * (w < 900 ? 0.5 : 0.72), cy = h * 0.42;
      const m = new DOMMatrix().translate(cx, cy).rotate(-8).scale(scale).translate(-12, -12);
      const path = new Path2D();
      path.addPath(leaf, m);
      const vein = new Path2D();
      vein.addPath(new Path2D('M4.6 19.4 17 7M9 15l-1.4-5M12 12l4.6 1.4M13.5 10.5l-1-4.2'), m);
      probe.lineWidth = Math.max(5, scale * 0.55);
      const dots = [];
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const inside = probe.isPointInPath(path, x, y);
          const v = inside && probe.isPointInStroke(vein, x, y);
          dots.push({ x, y, leaf: inside ? 1 : 0, vein: v });
        }
      }
      state.current.dots = dots;
    },
    (ctx, t, w, h) => {
      const s = state.current;
      s.t = t;
      ctx.clearRect(0, 0, w, h);
      const R = 150;
      for (const d of s.dots) {
        const wave = 0.5 + 0.5 * Math.sin(d.x * 0.011 + t * 0.7) * Math.cos(d.y * 0.013 - t * 0.45);
        const dx = d.x - s.px, dy = d.y - s.py;
        const dist2 = dx * dx + dy * dy;
        const glow = dist2 < R * R * 4 ? Math.exp(-dist2 / (2 * R * R)) : 0;
        let ring = 0;
        for (const r of s.ripples) {
          const age = t - r.t;
          if (age > 2.2) continue;
          const dd = Math.abs(Math.hypot(d.x - r.x, d.y - r.y) - age * 520);
          if (dd < 36) ring += (1 - dd / 36) * (1 - age / 2.2);
        }
        let a: number;
        if (d.leaf) {
          a = d.vein ? 0.1 : 0.4 + wave * 0.5;
          ctx.fillStyle = d.y < h * 0.36 ? '#ffb347' : '#ff7a2f';
        } else {
          a = 0.05 + wave * 0.05;
          ctx.fillStyle = '#f4e6d4';
        }
        a = Math.min(1, a + glow * 0.55 + ring * 0.7);
        if (a < 0.04) continue;
        if (glow > 0.2 || ring > 0.2) ctx.fillStyle = d.leaf ? '#ffd29a' : '#ffb27a';
        ctx.globalAlpha = a;
        const sz = 1.3 + a * 1.5;
        ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    },
    reduce,
  );

  return <canvas ref={ref} className={`dotfield ${className ?? ''}`} aria-hidden />;
}

type FallingLeaf = { x: number; y: number; z: number; r: number; vr: number; sway: number; phase: number; vx: number; c: string };

/** Slow falling leaves with depth; they drift away from the pointer. */
export function LeafFall({ count = 22, className }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = !!useReducedMotion();
  const s = useRef({ leaves: [] as FallingLeaf[], px: -9999, py: -9999, last: 0 });
  const colors = ['#ff7a2f', '#ffb347', '#c9542a', '#a6d86a', '#e88b3c', '#f2c66d'];

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); s.current.px = e.clientX - r.left; s.current.py = e.clientY - r.top; };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [reduce]);

  const spawn = (w: number, h: number, top: boolean): FallingLeaf => ({
    x: Math.random() * w,
    y: top ? -30 - Math.random() * 80 : Math.random() * h,
    z: 0.35 + Math.random() * 0.75,
    r: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 1.4,
    sway: 18 + Math.random() * 30,
    phase: Math.random() * Math.PI * 2,
    vx: 0,
    c: colors[Math.floor(Math.random() * colors.length)],
  });

  const leafPath = new Path2D(LEAF);
  useCanvasLoop(
    ref,
    (w, h) => {
      const n = w < 640 ? Math.round(count * 0.5) : count;
      if (s.current.leaves.length !== n) s.current.leaves = Array.from({ length: n }, () => spawn(w, h, false));
    },
    (ctx, t, w, h) => {
      const st = s.current;
      const dt = Math.min(0.05, t - st.last || 0.016);
      st.last = t;
      ctx.clearRect(0, 0, w, h);
      for (const l of st.leaves) {
        l.y += (22 + l.z * 38) * dt;
        const dx = l.x - st.px, dy = l.y - st.py, d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) { const f = (1 - Math.sqrt(d2) / 120) * 260; l.vx += (dx > 0 ? 1 : -1) * f * dt; }
        l.vx *= 0.94;
        l.x += l.vx * dt;
        l.r += l.vr * dt;
        if (l.y > h + 30) Object.assign(l, spawn(w, h, true));
        const x = l.x + Math.sin(t * 0.8 + l.phase) * l.sway;
        const size = 0.55 + l.z * 0.75;
        ctx.save();
        ctx.translate(x, l.y);
        ctx.rotate(l.r + Math.sin(t + l.phase) * 0.5);
        ctx.scale(size * Math.cos(t * 1.3 + l.phase) * 0.35 + size * 0.65, size);
        ctx.translate(-12, -12);
        ctx.globalAlpha = 0.25 + l.z * 0.55;
        ctx.fillStyle = l.c;
        ctx.fill(leafPath);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    reduce,
  );
  return <canvas ref={ref} className={`leaffall ${className ?? ''}`} aria-hidden />;
}

/** Two soft beams sweeping down from the top corners (Spotlight New, warmed up). */
export function Beams() {
  return (
    <div className="beams" aria-hidden>
      <span className="beam beam-l" />
      <span className="beam beam-r" />
      <span className="beam-core" />
    </div>
  );
}

/** A lamp glow for section headers: a cone of light opening from a bright filament. */
export function Lamp({ children }: { children: React.ReactNode }) {
  return (
    <div className="lamp">
      <div className="lamp-light" aria-hidden>
        <span className="lamp-cone lamp-cone-l" />
        <span className="lamp-cone lamp-cone-r" />
        <span className="lamp-bloom" />
        <span className="lamp-filament" />
      </div>
      <div className="lamp-content">{children}</div>
    </div>
  );
}
