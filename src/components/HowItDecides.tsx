import { ExternalLink } from 'lucide-react';
import { SOURCES } from '../../shared/sources';
import { Reveal, Spotlight } from '../lib/fx';

const RULES = [
  { id: 'R1', title: 'No valid reading, no plan', body: 'Missing cells, duplicates, or unknown labels stop the run. Nothing is filled in.', src: [] as string[] },
  { id: 'R2', title: 'Outside the scope, review only', body: 'These rules come from temperate North American autumn guidance. Elsewhere, every leafy patch becomes review-only.', src: ['cleanup'] },
  { id: 'R3', title: 'Keep paths usable', body: 'Leaves on a path or steps become a clearing task. A kept path also shows the rest is deliberate.', src: ['cues'] },
  { id: 'R4', title: 'Concerns come first', body: 'If you know of disease or site restrictions, or are not sure, no patch is marked “leave”. No disposal or fire advice.', src: ['cleanup'] },
  { id: 'R5', title: 'Unclear means look', body: 'Blurry, mixed, or unknown patches are sent to you to review instead of guessed.', src: ['cleanup'] },
  { id: 'R6', title: 'Leaves in beds can stay', body: 'Fallen leaves on beds and under trees: consider leaving them for now. Inspect first.', src: ['habitat'] },
  { id: 'R7', title: 'Lawns need a human eye', body: 'A photo can’t show depth. A light layer can be mulched; a thick mat can smother turf.', src: ['turf'] },
  { id: 'R8', title: 'Nothing there, nothing to do', body: 'No leaves on the ground means no task, and it doesn’t count as a chore saved.', src: [] },
];

export function HowItDecides() {
  return (
    <section id="rules" className="section rules">
      <Reveal className="section-head">
        <span className="mono kicker">02 — How it decides</span>
        <h2 className="h2">The model only <em>looks</em>. Plain rules make the call.</h2>
        <p className="lede">Gemma describes each patch with a few fixed labels. Eight short rules, run in your browser, turn those labels into suggestions. You can read every rule, and correcting a label re-runs them instantly without sending anything.</p>
      </Reveal>
      <Reveal className="pipeline" delay={0.1}>
        {['Your photo', 'Normalize · 3×3 grid', 'Gemma 4 reads 9 patches', 'Schema check', 'Rules in your browser', 'You correct'].map((s, i) => (
          <div key={s} className="pipe-step" style={{ ['--i' as string]: i }}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>
            <span>{s}</span>
          </div>
        ))}
      </Reveal>
      <ol className="rule-grid">
        {RULES.map((r, i) => (
          <Reveal as="li" key={r.id} delay={(i % 4) * 0.05}>
            <Spotlight className="rule-card">
              <span className="mono rule-id">{r.id}</span>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              {r.src.map((sid) => (
                <a key={sid} href={SOURCES[sid].url} target="_blank" rel="noreferrer" className="rule-src">
                  {SOURCES[sid].publisher} <ExternalLink size={11} aria-hidden />
                </a>
              ))}
            </Spotlight>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
