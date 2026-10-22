/*
 * Buttons: Moving Border + Hover Border Gradient + Magnetic Button folded into one
 * component with two looks. The glow follows the pointer; the border light orbits.
 */
import { motion, useReducedMotion, useSpring } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode, PointerEvent as RPointerEvent } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  magnetic?: boolean;
  children: ReactNode;
};

export function GlowButton({ variant = 'primary', size = 'md', magnetic = true, className, children, onPointerMove, onPointerLeave, ...rest }: Props) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 240, damping: 18 });
  const y = useSpring(0, { stiffness: 240, damping: 18 });
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--bx', `${e.clientX - r.left}px`);
    el.style.setProperty('--by', `${e.clientY - r.top}px`);
    if (magnetic && !reduce && e.pointerType === 'mouse' && !rest.disabled) {
      x.set((e.clientX - r.left - r.width / 2) * 0.22);
      y.set((e.clientY - r.top - r.height / 2) * 0.3);
    }
    onPointerMove?.(e);
  };
  const leave = (e: RPointerEvent<HTMLButtonElement>) => { x.set(0); y.set(0); onPointerLeave?.(e); };
  return (
    <motion.span className="gbtn-wrap" style={{ x, y }}>
      <button type="button" className={`gbtn gbtn-${variant} gbtn-${size} ${className ?? ''}`} onPointerMove={move} onPointerLeave={leave} {...rest}>
        <span className="gbtn-orbit" aria-hidden />
        <span className="gbtn-fill" aria-hidden />
        <span className="gbtn-label">{children}</span>
      </button>
    </motion.span>
  );
}

/** Small pill with a light sweeping along its border; used for announcements and badges. */
export function ShinePill({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const inner = (
    <>
      <span className="shine-pill-edge" aria-hidden />
      {children}
    </>
  );
  return href ? <a href={href} className={`shine-pill ${className ?? ''}`}>{inner}</a> : <span className={`shine-pill ${className ?? ''}`}>{inner}</span>;
}
