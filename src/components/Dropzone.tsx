import { Camera, ImageUp } from 'lucide-react';
import { useRef, useState } from 'react';

export function Dropzone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f && !disabled) onFile(f); }}
    >
      <div className="dz-art" aria-hidden>
        <ImageUp size={26} strokeWidth={1.6} />
      </div>
      <p className="dz-title">Drop one photo of your yard</p>
      <p className="dz-sub">JPEG, PNG or WebP · up to 8 MB · stand back so paths and beds are both in frame. Sent once to Google’s Gemini API to run Gemma; RakeLess stores nothing.</p>
      <div className="dz-actions">
        <button type="button" className="btn btn-ink" disabled={disabled} onClick={() => input.current?.click()}>
          <ImageUp size={16} aria-hidden /> Choose photo
        </button>
        <label className={`btn btn-ghost ${disabled ? 'disabled' : ''}`}>
          <Camera size={16} aria-hidden /> Take photo
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
