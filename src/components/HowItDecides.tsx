import { ExternalLink } from 'lucide-react';
import type { Action } from '../../shared/schema';
import { SOURCES } from '../../shared/sources';
import { ACTION_META } from '../lib/actions';
import { Reveal } from '../lib/fx';
import { GlowCard } from '../ui/cards';
import { TracingBeam } from '../ui/scroll';

const RULES: { id: string; title: string; body: string; src: string[]; out: Action | 'stop' }[] = [
  { id: 'R1', title: 'No valid reading, no plan', body: 'Missing cells, duplicates, or unknown labels stop the run. Nothing is filled in.', src: [], out: 'stop' },
  { id: 'R2', title: 'Outside the scope, review only', body: 'These rules come from temperate North American autumn guidance. Elsewhere, every leafy patch becomes review-only.', src: ['cleanup'], out: 'review' },
  { id: 'R3', title: 'Keep paths usable', body: 'Leaves on a path or steps become a clearing task. A kept path also shows the rest is deliberate.', src: ['cues'], out: 'clear' },
  { id: 'R4', title: 'Concerns come first', body: 'If you know of disease or site restrictions, or are not sure, no patch is marked “leave”. No disposal or fire advice.', src: ['cleanup'], out: 'review' },
  { id: 'R5', title: 'Unclear means look', body: 'Blurry, mixed, or unknown patches are sent to you to review instead of guessed.', src: ['cleanup'], out: 'review' },
  { id: 'R6', title: 'Leaves in beds can stay', body: 'Fallen leaves on beds and under trees: consider leaving them for now. Inspect first.', src: ['habitat'], out: 'leave' },
  { id: 'R7', title: 'Lawns need a human eye', body: 'A photo can’t show depth. A light layer can be mulched; a thick mat can smother turf.', src: ['turf'], out: 'review' },
  { id: 'R8', title: 'Nothing there, nothing to do', body: 'No leaves on the ground means no task, and it doesn’t count as a chore saved.', src: [], out: 'none' },
];

const PIPELINE = [
  { t: 'Your photo', d: 'One JPEG, PNG or WebP, up to 8 MB.' },
  { t: 'Normalize · 3×3 grid', d: 'Rotated upright, resized, metadata stripped, split into nine patches.' },
  { t: 'Gemma 4 reads 9 patches', d: 'Hosted (Gemini API) or local (Ollama), chosen by the server. Surface, leaves on the ground, and visibility. Labels only, temperature 0.' },
  { t: 'Schema check', d: 'Exactly nine cells with valid labels, checked on the server and again in your browser.' },
  { t: 'Rules in your browser', d: 'Nine ordered rules turn labels into one of four marks. Uncertainty is checked before paths.' },
  { t: 'You correct', d: 'Fix any label and the plan updates instantly. Both values are kept.' },
];

export function HowItDecides() {
  return (
    <section id="rules" className="section rules">
      <div className="rules-split">
        <Reveal className="section-head sticky-head">
          <span className="eyebrow">How it decides</span>
          <h2 className="h2">The model only <span className="accent">looks</span>. Plain rules make the call.</h2>
          <p className="lede">Gemma describes each patch with a few fixed labels. Nine short rules, run in your browser, turn those labels into suggestions. You can read every rule, and correcting a label re-runs them without sending anything.</p>
        </Reveal>
        <TracingBeam className="pipeline">
          <ol>
            {PIPELINE.map((s, i) => (
              <Reveal as="li" key={s.t} className="pipe-step" delay={i * 0.04}>
                <span className="pipe-num mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </TracingBeam>
      </div>

      <ol className="rule-grid">
        {RULES.map((r, i) => {
          const meta = r.out === 'stop' ? null : ACTION_META[r.out];
          return (
            <Reveal as="li" key={r.id} delay={(i % 4) * 0.06}>
              <GlowCard className="rule-card" tone={meta?.tone ?? 'stone'}>
                <span className="rule-ghost" aria-hidden>{r.id}</span>
                <div className="rule-top">
                  <span className="rule-id mono">{r.id}</span>
                  <span className={`rule-out ${r.out === 'stop' ? 'out-stop' : `act-${r.out}`}`}>
                    {meta ? <><meta.Icon size={12} aria-hidden /> {meta.short}</> : 'Stop'}
                  </span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                {r.src.map((sid) => (
                  <a key={sid} href={SOURCES[sid].url} target="_blank" rel="noreferrer" className="rule-src">
                    {SOURCES[sid].publisher} <ExternalLink size={11} aria-hidden />
                  </a>
                ))}
              </GlowCard>
            </Reveal>
          );
        })}
      </ol>
    </section>
  );
}
