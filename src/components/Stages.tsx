/* Multi-step loader: each stage lights up in turn along a progress rail. */
import { motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Stage } from '../lib/api';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'preparing', label: 'Checking the file' },
  { id: 'uploading', label: 'Sending photo to the server' },
  { id: 'reading', label: 'Decoding, then Gemma reads nine patches' },
  { id: 'validating', label: 'Validating the response' },
  { id: 'rules', label: 'Applying the rules' },
];

export function Stages({ stage, onCancel }: { stage: Stage; onCancel: () => void }) {
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(i); }, []);
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="stages" aria-live="polite">
      <div className="stages-rail" aria-hidden><motion.span animate={{ scaleY: (at + 0.5) / STAGES.length }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
      <ol>
        {STAGES.map((s, i) => (
          <motion.li key={s.id} className={i < at ? 'done' : i === at ? 'now' : 'todo'} initial={{ opacity: 0, x: -6 }} animate={{ opacity: i > at ? 0.45 : 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <span className="stage-icon" aria-hidden>{i < at ? <Check size={13} /> : i === at ? <Loader2 size={13} className="spin" /> : null}</span>
            {s.label}
          </motion.li>
        ))}
      </ol>
      <div className="stages-foot">
        <span className="mono">{((now - t0) / 1000).toFixed(1)} s elapsed</span>
        <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
