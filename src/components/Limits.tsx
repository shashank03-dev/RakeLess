import { Reveal } from '../lib/fx';

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
      <Reveal className="section-head">
        <span className="mono kicker">03 — Limits</span>
        <h2 className="h2">What a photo <em>can’t</em> tell you.</h2>
        <p className="lede">Every result is provisional. Walk the patch before you act on it. RakeLess never calls a patch safe or certified, and it never gives disposal or burning advice.</p>
      </Reveal>
      <ul className="cannot">
        {CANNOT.map((c, i) => (
          <Reveal as="li" key={c} delay={i * 0.04}>
            <span className="mono">✕</span> {c}
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
