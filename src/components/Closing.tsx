import { ArrowRight, FlaskConical } from 'lucide-react';
import { Reveal } from '../lib/fx';
import { Lamp } from '../ui/backgrounds';
import { GlowButton } from '../ui/buttons';
import { Wordmark } from '../ui/text';
import { LeafMark } from './Nav';

export function FinalCta({ onTry, onExample }: { onTry: () => void; onExample: () => void }) {
  return (
    <section className="final">
      <Lamp>
        <Reveal className="final-inner">
          <h2 className="h2 final-title">Go look at your yard.<br />Then rake <span className="accent">less</span>.</h2>
          <p className="lede">One photo, nine patches, about fifteen seconds. Every suggestion is provisional, so walk the patch before you act.</p>
          <div className="hero-ctas center">
            <GlowButton size="lg" onClick={onTry}>Check my photo <ArrowRight size={18} aria-hidden /></GlowButton>
            <GlowButton size="lg" variant="ghost" onClick={onExample}><FlaskConical size={17} aria-hidden /> Recorded example</GlowButton>
          </div>
        </Reveal>
      </Lamp>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <a href="#top" className="brand" aria-label="Back to top"><LeafMark size={20} /><span>Rake<em>Less</em></span></a>
        <nav aria-label="Footer">
          <a href="#features">Features</a>
          <a href="#try">Try it</a>
          <a href="#rules">How it decides</a>
          <a href="#limits">Limits</a>
        </nav>
      </div>
      <div className="footer-cols">
        <p>A small build for the DEV Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady. Gemma 4 open-weight vision, served through the Gemini API. The rules are plain TypeScript.</p>
        <p>Sources inform the prototype rules. They are not endorsements or expert review of this app. Photo credit: Michael Gil, CC BY 2.0.</p>
        <p className="mono">MIT licensed · no accounts · no tracking · photos are not stored</p>
      </div>
      <div className="footer-mark"><Wordmark /></div>
    </footer>
  );
}
