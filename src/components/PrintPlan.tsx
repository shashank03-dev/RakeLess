import type { Context, Decision } from '../../shared/schema';
import type { Receipt } from '../../shared/receipt';
import { runKindLabel } from '../lib/actions';
import type { EffectiveObservation } from '../../shared/rules';
import { SOURCES } from '../../shared/sources';
import type { Run } from '../lib/api';
import { PhotoMap } from './PhotoMap';

const CTX: Record<string, string> = { none: 'none known', yes: 'yes', not_sure: 'not sure', temperate_na: 'temperate North America', other: 'other', unsure: 'not sure', autumn: 'autumn' };

export function PrintPlan({ run, decisions, effective, ctx, withSign, receipt }: { run: Run; decisions: Decision[]; effective: EffectiveObservation[]; ctx: Context; withSign: boolean; receipt: Receipt | null }) {
  const group = (a: Decision['action']) => decisions.filter((d) => d.action === a);
  const used = [...new Set(decisions.flatMap((d) => d.sourceIds))];
  return (
    <div className="print-only" aria-hidden>
      <article className="print-page">
        <header className="print-head">
          <h1>RakeLess leaf plan</h1>
          <p>{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })} · Site concerns: {CTX[ctx.concerns]} · Region: {CTX[ctx.region]} · Season: {CTX[ctx.season]}</p>
        </header>
        <div className="print-body">
          <div className="print-map">
            <PhotoMap src={run.image.src} width={run.image.width} height={run.image.height} decisions={decisions} effective={effective} selected={null} onSelect={() => {}} compact />
          </div>
          <div className="print-lists">
            {(['clear', 'review', 'leave'] as const).map((a) => (
              <section key={a}>
                <h2>{a === 'clear' ? 'Clear access' : a === 'review' ? 'Review closely' : 'Leave for now'}</h2>
                <ul>{group(a).map((d) => <li key={d.id}><b>{d.id}</b> {d.title}{d.basis === 'user' ? ' (your correction)' : ''}</li>)}{group(a).length === 0 && <li>None</li>}</ul>
              </section>
            ))}
          </div>
        </div>
        {receipt && receipt.intendedCount > 0 && (
          <section className="receipt-print">
            <h2>Chore receipt</h2>
            <p>You planned {receipt.intendedCount} patch{receipt.intendedCount === 1 ? '' : 'es'}. Reconsider: {receipt.reconsider.map((l) => l.id).join(', ') || 'none'}. Inspect first: {receipt.inspect.map((l) => l.id).join(', ') || 'none'}. No leaf task seen: {receipt.noTask.map((l) => l.id).join(', ') || 'none'}. Access work to keep: {receipt.keepAccess.map((l) => l.id).join(', ') || 'none'}.</p>
            <p>Counts are grid cells, not area or time.</p>
          </section>
        )}
        <footer className="print-foot">
          <p><b>Scope:</b> suggestions for temperate North American autumn yards. They come from a photo and are not a survey or certification. Inspect each patch before acting.</p>
          <p><b>Run:</b> {runKindLabel(run)} · {run.provenance.providerLabel ?? run.provenance.provider} · {run.provenance.modelName}{run.provenance.modelVersion ? ` (${run.provenance.modelVersion})` : ''} · {run.provenance.promptVersion} · {run.provenance.rulesVersion} · image sha256 {run.provenance.normalizedImageSha256.slice(0, 12)}… · <b>Sources:</b> {used.map((s) => `${SOURCES[s].publisher}, “${SOURCES[s].title}”`).join('; ') || 'none used'}</p>
        </footer>
      </article>
      {withSign && (
        <article className="print-page sign">
          <div className="sign-inner">
            <svg viewBox="0 0 60 60" width="90" height="90" aria-hidden><path d="M8 52C8 26 24 9 52 8c-1 28-18 44-44 44Z" fill="none" stroke="#24352A" strokeWidth="3" /><path d="M8 52 38 22" stroke="#24352A" strokeWidth="3" strokeLinecap="round" /></svg>
            <h1>Leaves left on purpose.</h1>
            <p>This patch is being kept as seasonal cover.</p>
          </div>
        </article>
      )}
    </div>
  );
}
