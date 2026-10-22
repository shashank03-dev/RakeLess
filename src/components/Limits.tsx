import { ShieldAlert, X } from 'lucide-react';
import { Reveal } from '../lib/fx';
import { GlowCard } from '../ui/cards';
import { Scramble } from '../ui/text';

const CANNOT = [
  'Measure how deep the leaves are',
  'Spot plant disease or pests',
  'Know your local fire or leaf rules',
  'Tell whether insects or animals live there',
  'Check if a path is safe or accessible',
  'Measure area. The 3×3 grid is a rough split of the photo, not a survey',
  'Prove the model’s labels are correct',
];

export function Limits() {
  return (
    <section id="limits" className="section limits">
      <div className="limits-split">
        <Reveal className="section-head">
          <span className="eyebrow eyebrow-warn">Limits</span>
          <h2 className="h2">What a photo <span className="accent">can’t</span> tell you.</h2>
          <p className="lede">Every result is provisional. Walk the patch before you act on it.</p>
          <GlowCard className="promise" tone="brick">
            <ShieldAlert size={20} aria-hidden />
            <p>RakeLess never calls a patch safe or certified, and it never gives disposal or burning advice.</p>
          </GlowCard>
        </Reveal>
        <ul className="cannot">
          {CANNOT.map((c, i) => (
            <Reveal as="li" key={c} delay={i * 0.05}>
              <span className="cannot-x" aria-hidden><X size={14} /></span>
              <Scramble text={c} delay={0.1 + i * 0.08} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
