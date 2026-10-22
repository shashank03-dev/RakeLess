import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Eye, FlaskConical, Lock, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Context, PatchId } from '../../shared/schema';
import { applyCorrections, decide, summarize } from '../../shared/rules';
import type { Run } from '../lib/api';
import { CountUp } from '../lib/fx';
import { ACTION_META } from '../lib/actions';
import { Beams, DotField, LeafFall } from '../ui/backgrounds';
import { GlowButton, ShinePill } from '../ui/buttons';
import { ScrollStage } from '../ui/scroll';
import { FlipWords, SplitWords } from '../ui/text';
import { PhotoMap } from './PhotoMap';
import { ChoreLedger } from './ChoreLedger';

const HERO_CTX: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };
const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ example, onTry, onExample }: { example: Run; onTry: () => void; onExample: () => void }) {
  const decisions = useMemo(() => decide(example.observations, HERO_CTX), [example]);
  const effective = useMemo(() => applyCorrections(example.observations, []), [example]);
  const s = summarize(decisions);
  const leafy = s.leave + s.clear + s.review;
  const [sel, setSel] = useState<PatchId | null>(null);
  const d = decisions.find((x) => x.id === sel);

  return (
    <section id="top" className="hero">
      <div className="hero-bg" aria-hidden>
        <DotField />
        <Beams />
        <div className="hero-vignette" />
      </div>
      <LeafFall />

      <div className="hero-copy">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <ShinePill href="#rules">
            <span className="pill-dot" aria-hidden /> Gemma 4 open-weight vision <span className="pill-sep" aria-hidden /> <span className="pill-muted">8 plain rules</span> <ArrowRight size={13} aria-hidden />
          </ShinePill>
        </motion.div>

        <h1 className="display">
          <SplitWords text="Your yard needs less raking than you think." accent={['less']} delay={0.1} />
        </h1>

        <motion.p className="hero-flip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 0.6 }}>
          Leave the leaves under <FlipWords words={['your trees', 'garden beds', 'the shrubs', 'tree roots']} />. Clear the paths.
        </motion.p>

        <motion.p className="hero-sub" initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.85, duration: 0.8, ease }}>
          Take one photo of your autumn yard. RakeLess splits it into nine patches, marks which leaves you can leave alone and which spots still need clearing, and gives a reason for each one.
        </motion.p>

        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.7, ease }}>
          <GlowButton size="lg" onClick={onTry}>Check my photo <ArrowRight size={18} aria-hidden /></GlowButton>
          <GlowButton size="lg" variant="ghost" onClick={onExample}><FlaskConical size={17} aria-hidden /> See a recorded example</GlowButton>
        </motion.div>

        <motion.ul className="hero-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}>
          <li><Lock size={14} aria-hidden /> Photos aren’t stored</li>
          <li><ScrollText size={14} aria-hidden /> Rules you can read</li>
          <li><Eye size={14} aria-hidden /> Inspect before acting</li>
        </motion.ul>
      </div>

      <motion.div className="hero-stage" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1.1, ease }}>
        <ScrollStage>
          <div className="window">
            <div className="window-bar">
              <span className="window-dots" aria-hidden><i /><i /><i /></span>
              <span className="window-url mono"><span className="rec-dot" aria-hidden /> recorded run · {example.provenance.modelName} · {(example.provenance.durationMs / 1000).toFixed(1)} s</span>
              <span className="window-tag mono">3×3</span>
            </div>
            <div className="window-body">
              <div className="window-map">
                <PhotoMap src={example.image.src} width={example.image.width} height={example.image.height} decisions={decisions} effective={effective} selected={sel} onSelect={(id) => setSel(id === sel ? null : id)} compact />
              </div>
              <div className="window-side">
                <dl className="stat-tiles">
                  <div className="stat"><dt>Leafy patches</dt><dd><CountUp value={leafy} /></dd></div>
                  <div className="stat stat-leave"><dt>Chores that can wait</dt><dd><CountUp value={s.leave} /></dd></div>
                  <div className="stat stat-clear"><dt>Paths to clear</dt><dd><CountUp value={s.clear} /></dd></div>
                </dl>
                <ChoreLedger decisions={decisions} />
                <div className="window-note" aria-live="polite">
                  <AnimatePresence mode="wait">
                    {d ? (
                      <motion.p key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        <span className="note-k mono"><span className={`mini-tag act-${d.action}`}>{d.id}</span> {d.title}</span><span className="muted">“{example.observations.find((o) => o.id === d.id)?.evidence}”</span>
                      </motion.p>
                    ) : (
                      <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span className="note-k mono">Model notes</span><span className="muted">Saved real run. Tap any patch on the photo to see what Gemma saw there.</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="legend-mini" aria-hidden>
                  {(['leave', 'clear', 'review', 'none'] as const).map((a) => {
                    const m = ACTION_META[a];
                    return <span key={a} className={`legend-dot act-${a}`}><m.Icon size={11} /> {m.short}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="float-chip float-a" aria-hidden><span className="mini-tag act-clear">C3</span> Gravel lane · clear access</div>
          <div className="float-chip float-b" aria-hidden><span className="mini-tag act-leave">C1</span> Leaf cover · leave for now</div>
        </ScrollStage>
        <p className="credit">Photo: “Fallen Leaves October 2011” by Michael Gil, Ontario, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a>. Resized, grid added.</p>
      </motion.div>
    </section>
  );
}
