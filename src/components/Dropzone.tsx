/* Upload area in the spirit of Aceternity's File Upload: a lit grid, a card that lifts toward the drop. */
import { motion, useReducedMotion } from 'motion/react';
import { Camera, ImageUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { GlowButton } from '../ui/buttons';

export function Dropzone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f && !disabled) onFile(f); }}
    >
      <div className="dz-grid" aria-hidden />
      <motion.div className="dz-art" aria-hidden animate={reduce ? undefined : over ? { y: -10, rotate: -4, scale: 1.08 } : { y: [0, -5, 0] }}
        transition={over ? { type: 'spring', stiffness: 300, damping: 18 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="dz-ghost" />
        <ImageUp size={26} strokeWidth={1.6} />
      </motion.div>
      <p className="dz-title">{over ? 'Drop it here' : 'Drop one photo of your yard'}</p>
      <p className="dz-sub">JPEG, PNG or WebP · up to 8 MB · stand back so paths and beds are both in frame. Sent once to Google’s Gemini API to run Gemma; RakeLess stores nothing.</p>
      <div className="dz-actions">
        <GlowButton size="sm" disabled={disabled} onClick={() => input.current?.click()}><ImageUp size={16} aria-hidden /> Choose photo</GlowButton>
        <GlowButton size="sm" variant="ghost" disabled={disabled} onClick={() => camera.current?.click()}><Camera size={16} aria-hidden /> Take photo</GlowButton>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
