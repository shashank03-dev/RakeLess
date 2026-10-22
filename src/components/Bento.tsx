import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ExternalLink, Fingerprint, Printer, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Context, Correction, Observation } from '../../shared/schema';
import { applyCorrections, decide } from '../../shared/rules';
import { SOURCES } from '../../shared/sources';
import type { Run } from '../lib/api';
import { ACTION_META, SURFACE_LABEL } from '../lib/actions';
import { Reveal } from '../lib/fx';
import { CardStack, CipherCard, Compare, GlowCard } from '../ui/cards';
import { Typewriter } from '../ui/text';
import { PhotoMap } from './PhotoMap';

const CTX: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };

export function Bento({ example }: { example: Run }) {
  const decisions = useMemo(() => decide(example.observations, CTX), [example]);
  const effective = useMemo(() => applyCorrections(example.observations, []), [example]);
  const c3 = example.observations.find((o) => o.id === 'C3')!;
  const { width, height, src } = example.image;

  return (
    <section id="features" className="section bento-section">
      <Reveal as="header" className="section-head center">
        <span className="eyebrow">What it does</span>
        <h2 className="h2">One photo in. <span className="accent">A reason</span> for every patch out.</h2>
        <p className="lede">Gemma 4 labels what it sees. Plain rules turn those labels into suggestions you can check, correct, and print.</p>
      </Reveal>

      <div className="bento">
        <Reveal className="bento-cell b-compare">
          <GlowCard className="bento-card">
            <div className="bento-copy">
              <span className="bento-icon" aria-hidden><Sparkles size={16} /></span>
              <h3>Nine patches, one honest map</h3>
              <p>Drag across the photo. Each patch gets one of four marks, and anything unclear goes to you instead of being guessed.</p>
            </div>
            <Compare
              className="bento-media"
              beforeLabel="Your photo"
              afterLabel="RakeLess map"
              before={<img src={src} alt="" className="compare-img" draggable={false} />}
              after={<PhotoMap src={src} width={width} height={height} decisions={decisions} effective={effective} selected={null} onSelect={() => {}} compact />}
            />
          </GlowCard>
        </Reveal>

        <Reveal className="bento-cell b-terminal" delay={0.05}>
          <GlowCard className="bento-card">
            <div className="bento-copy">
              <span className="bento-icon" aria-hidden><Fingerprint size={16} /></span>
              <h3>The model only looks</h3>
              <p>It returns labels, never advice. The rules make the call.</p>
            </div>
            <div className="term">
              <div className="term-bar"><span className="window-dots" aria-hidden><i /><i /><i /></span><span className="mono">gemma → rules</span></div>
              <Typewriter lines={[
                { text: `{ "id": "${c3.id}",`, cls: 't-punc' },
                { text: `  "surface": "${c3.surface}",`, cls: 't-key' },
                { text: `  "material": "${c3.material}" }`, cls: 't-key' },
                { text: `→ R3 · ${decisions.find((x) => x.id === 'C3')!.title}`, cls: 't-out' },
              ]} />
            </div>
          </GlowCard>
        </Reveal>

        <Reveal className="bento-cell b-correct" delay={0.1}>
          <GlowCard className="bento-card">
            <div className="bento-copy">
              <span className="bento-icon" aria-hidden><SlidersHorizontal size={16} /></span>
              <h3>Wrong label? Fix it</h3>
              <p>Corrections re-run the rules in your browser. No second AI call.</p>
            </div>
            <CorrectionDemo base={example.observations.find((o) => o.id === 'C1')!} />
          </GlowCard>
        </Reveal>

        <Reveal className="bento-cell b-sources" delay={0.05}>
          <GlowCard className="bento-card">
            <div className="bento-copy">
              <span className="bento-icon" aria-hidden><ExternalLink size={16} /></span>
              <h3>Every call cites a source</h3>
              <p>Extension services and wildlife research, paraphrased and linked.</p>
            </div>
            <CardStack
              items={Object.values(SOURCES)}
              keyOf={(s) => s.id}
              render={(s) => (
                <a href={s.url} target="_blank" rel="noreferrer" className="src-card">
                  <span className="src-pub">{s.publisher}</span>
                  <span className="src-title">{s.title}</span>
                  <span className="src-sum">{s.summary}</span>
                </a>
              )}
            />
          </GlowCard>
        </Reveal>

        <Reveal className="bento-cell b-private" delay={0.1}>
          <GlowCard className="bento-card cipher-host">
            <CipherCard className="bento-cipher">
              <span className="cipher-badge mono">sha256 · {example.provenance.normalizedImageSha256.slice(0, 12)}…</span>
            </CipherCard>
            <div className="bento-copy">
              <h3>You can see where your photo goes</h3>
              <p>Metadata is stripped on the server. The page tells you before upload whether the model is hosted (Google’s Gemini API) or running locally through Ollama. RakeLess keeps no images; only the nine text labels are cached in memory for up to 10 minutes. No accounts, no tracking.</p>
            </div>
          </GlowCard>
        </Reveal>

        <Reveal className="bento-cell b-sign" delay={0.15}>
          <GlowCard className="bento-card">
            <div className="bento-copy">
              <span className="bento-icon" aria-hidden><Printer size={16} /></span>
              <h3>Print the plan, and a sign</h3>
              <p>A one-page plan, plus an optional yard sign so neighbours know the leaves are deliberate.</p>
            </div>
            <div className="sign-mock" aria-hidden>
              <span className="sign-stake" />
              <div className="sign-board">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4 20 13 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                <b>Leaves left on purpose.</b>
                <span>This patch is being kept as seasonal cover.</span>
              </div>
            </div>
          </GlowCard>
        </Reveal>
      </div>
    </section>
  );
}

/** Loops a real correction: the model's label vs. a user fix, run through the same rules. */
function CorrectionDemo({ base }: { base: Observation }) {
  const reduce = useReducedMotion();
  const options: (Correction | null)[] = [null, { id: base.id, surface: 'lawn' }, { id: base.id, surface: 'path_or_steps' }];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % options.length), 2600);
    return () => clearInterval(t);
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  const corr = options[i];
  const others = Array.from({ length: 8 }, (_, k) => ({ ...base, id: (['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C2', 'C3'] as const)[k] }));
  const d = decide([base, ...others], CTX, corr ? [corr] : [])[0];
  const surface = corr?.surface ?? base.surface;
  const meta = ACTION_META[d.action];
  return (
    <div className="demo">
      <div className="demo-row">
        <span className="mono demo-k">{base.id} surface</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={surface} className={`demo-chip ${corr ? 'user' : ''}`} initial={{ y: 10, opacity: 0, filter: 'blur(4px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: -10, opacity: 0, filter: 'blur(4px)' }}>
            {SURFACE_LABEL[surface]} {corr && <em className="mono">you</em>}
          </motion.span>
        </AnimatePresence>
      </div>
      <ArrowRight size={14} className="demo-arrow" aria-hidden />
      <div className="demo-row">
        <span className="mono demo-k">rule {d.ruleId}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={d.action} className={`demo-result act-${d.action}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }}>
            <meta.Icon size={13} aria-hidden /> {meta.label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
