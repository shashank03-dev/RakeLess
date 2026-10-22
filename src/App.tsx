import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Download, FlaskConical, Printer, RotateCcw, Radio } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONTEXT, type Context, type Correction, type PatchId } from '../shared/schema';
import { applyCorrections, decide, summarize } from '../shared/rules';
import { SOURCES } from '../shared/sources';
import exampleRun from '../data/example-run.json';
import { analyzePhoto, ApiError, getExample, type Run, type Stage } from './lib/api';
import { CountUp, Reveal, VelocityMarquee, useLeafBurst } from './lib/fx';
import { ACTION_META } from './lib/actions';
import { GlowButton } from './ui/buttons';
import { GlowCard } from './ui/cards';
import { InfiniteCards } from './ui/scroll';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Bento } from './components/Bento';
import { FinalCta, Footer } from './components/Closing';
import { PhotoMap } from './components/PhotoMap';
import { PatchInspector } from './components/PatchInspector';
import { ActionList } from './components/ActionList';
import { ChoreLedger } from './components/ChoreLedger';
import { ContextPanel } from './components/ContextPanel';
import { useHealth } from './components/ModelStatus';
import { Stages } from './components/Stages';
import { Dropzone } from './components/Dropzone';
import { HowItDecides } from './components/HowItDecides';
import { Limits } from './components/Limits';
import { PrintPlan } from './components/PrintPlan';

const EXAMPLE = exampleRun as unknown as Run;

export default function App() {
  const health = useHealth();
  const workbench = useRef<HTMLElement>(null);
  const goTry = () => workbench.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const [requestExample, setRequestExample] = useState(0);
  const showExample = () => { setRequestExample((n) => n + 1); goTry(); };

  return (
    <>
      <div className="grain" aria-hidden />
      <Nav health={health} />
      <main>
        <Hero example={EXAMPLE} onTry={goTry} onExample={showExample} />
        <SourcesStrip />
        <Bento example={EXAMPLE} />
        <VelocityMarquee items={['Leave for now', 'Clear access', 'Review closely', 'No leaf task', 'Inspect before acting']} />
        <Workbench ref={workbench} requestExample={requestExample} modelReady={health !== null && health !== 'error' && health.model.ready} />
        <HowItDecides />
        <Limits />
        <FinalCta onTry={goTry} onExample={showExample} />
      </main>
      <Footer />
    </>
  );
}

function SourcesStrip() {
  return (
    <section className="sources-strip">
      <p className="strip-label mono">Rules informed by</p>
      <InfiniteCards label="Sources behind the rules" speed={46}>
        {Object.values(SOURCES).map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="strip-card">
            <span className="strip-pub">{s.publisher}</span>
            <span className="strip-title">{s.title}</span>
          </a>
        ))}
      </InfiniteCards>
    </section>
  );
}

type Busy = { stage: Stage; ctrl: AbortController };

const Workbench = ({ ref, requestExample, modelReady }: { ref: React.Ref<HTMLElement>; requestExample: number; modelReady: boolean }) => {
  const [ctx, setCtx] = useState<Context>(DEFAULT_CONTEXT);
  const [run, setRun] = useState<Run | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [selected, setSelected] = useState<PatchId | null>(null);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [withSign, setWithSign] = useState(true);
  const burst = useLeafBurst();
  const panel = useRef<HTMLDivElement>(null);

  const decisions = useMemo(() => (run ? decide(run.observations, ctx, corrections) : []), [run, ctx, corrections]);
  const effective = useMemo(() => (run ? applyCorrections(run.observations, corrections) : []), [run, corrections]);
  const summary = summarize(decisions);
  const held = decisions.filter((d) => d.ruleId === 'R4').length;
  const prevActions = useRef<Record<string, string>>({});

  // A chore that flips to "leave" gets a small leaf burst at its action card.
  useEffect(() => {
    const prev = prevActions.current;
    for (const d of decisions) {
      if (prev[d.id] && prev[d.id] !== 'leave' && d.action === 'leave') {
        const el = document.querySelector(`.board-photo .cell[aria-label^="${d.id}:"]`) as HTMLElement | null;
        const r = (el ?? panel.current)?.getBoundingClientRect();
        if (r) burst.fire(r.left + r.width / 2, r.top + r.height / 2);
      }
    }
    prevActions.current = Object.fromEntries(decisions.map((d) => [d.id, d.action]));
  }, [decisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExample = async () => {
    setError(null);
    try {
      const ex = await getExample('fallen-leaves');
      reset(false);
      setRun(ex);
      setAnnounce('Recorded example loaded.');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => { if (requestExample > 0) loadExample(); }, [requestExample]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = (clearCtx = true) => {
    busy?.ctrl.abort();
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null); setRun(null); setCorrections([]); setSelected(null); setError(null); setBusy(null);
    prevActions.current = {};
    if (clearCtx) setCtx(DEFAULT_CONTEXT);
  };

  const pick = (file: File) => {
    reset(false);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const analyze = async () => {
    if (!pending) return;
    const ctrl = new AbortController();
    setError(null);
    setBusy({ stage: 'preparing', ctrl });
    try {
      const out = await analyzePhoto(pending.file, ctx, (stage) => setBusy({ stage, ctrl }), ctrl.signal);
      URL.revokeObjectURL(pending.url);
      setPending(null);
      setRun(out);
      setCorrections([]);
      setAnnounce(`Analysis complete${out.provenance.cacheHit ? ' (cached result)' : ''}. Nine patches mapped.`);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 499)) setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setBusy(null);
    }
  };

  const correct = (id: PatchId, c: Correction | null) =>
    setCorrections((cs) => [...cs.filter((x) => x.id !== id), ...(c ? [c] : [])]);

  const exportJson = () => {
    if (!run) return;
    const doc = {
      app: 'RakeLess',
      exportedAtUtc: new Date().toISOString(),
      scopeNote: 'Photo-based suggestions for temperate North American autumn yards. Not a survey or certification; inspect before acting.',
      context: ctx,
      image: { width: run.image.width, height: run.image.height },
      provenance: run.provenance,
      originalObservations: run.observations,
      userCorrections: corrections,
      decisions,
      sourceIds: [...new Set(decisions.flatMap((d) => d.sourceIds))],
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    a.download = `rakeless-plan-${run.provenance.normalizedImageSha256.slice(0, 8)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const sel = selected && run ? selected : null;
  const p = run?.provenance;

  return (
    <section id="try" ref={ref} className="section workbench">
      <Reveal as="header" className="section-head center">
        <span className="eyebrow">The workbench</span>
        <h2 className="h2">One photo. Nine patches. <span className="accent">A reason</span> for each one.</h2>
        <p className="lede">Tell RakeLess about your site, add a photo, and get a map you can correct patch by patch.</p>
      </Reveal>

      <div className="steps">
        <Reveal className="step-wrap">
          <GlowCard className="step">
          <div className="step-num mono">01</div>
          <div className="step-body">
            <h3 className="h3">Your site</h3>
            <ContextPanel ctx={ctx} onChange={setCtx} />
          </div>
          </GlowCard>
        </Reveal>

        <Reveal className="step-wrap" delay={0.05}>
          <GlowCard className="step">
          <div className="step-num mono">02</div>
          <div className="step-body">
            <h3 className="h3">Your photo</h3>
            {!run && !pending && (
              <>
                <Dropzone onFile={pick} disabled={!!busy} />
                <div className="or-row">
                  <span>or</span>
                  <button type="button" className="link-btn strong" onClick={loadExample}><FlaskConical size={15} aria-hidden /> Load the recorded example. No model call.</button>
                </div>
                {!modelReady && <p className="ctx-note warn">The live model isn’t reachable right now, so new photos can’t be analyzed. The recorded example still works.</p>}
              </>
            )}
            {pending && (
              <div className="pending">
                <img src={pending.url} alt="Preview of the selected photo" />
                {busy ? (
                  <Stages stage={busy.stage} onCancel={() => busy.ctrl.abort()} />
                ) : (
                  <div className="pending-actions">
                    <p className="mono fineprint">{pending.file.name} · {(pending.file.size / 1024 / 1024).toFixed(1)} MB</p>
                    <GlowButton onClick={analyze} disabled={!modelReady}>Analyze with Gemma <ArrowRight size={16} aria-hidden /></GlowButton>
                    <button type="button" className="link-btn" onClick={() => reset(false)}>Choose a different photo</button>
                  </div>
                )}
              </div>
            )}
            <AnimatePresence>
              {error && (
                <motion.div className="error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <AlertTriangle size={18} aria-hidden />
                  <div><b>No plan was made.</b> {error}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </GlowCard>
        </Reveal>
      </div>

      <div className="sr-only" aria-live="polite">{announce}</div>

      {run && p && (
        <motion.div className="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className={`provenance mode-${p.mode}`}>
            {p.mode === 'recorded' ? <FlaskConical size={15} aria-hidden /> : <Radio size={15} aria-hidden />}
            <span className="mono">
              {p.mode === 'recorded' ? 'RECORDED RUN' : 'LIVE RUN'}{p.cacheHit ? ' · CACHED' : ''} · {p.modelName} · {(p.durationMs / 1000).toFixed(1)} s · retries {p.retryCount} · {new Date(p.timestampUtc).toISOString().slice(0, 16).replace('T', ' ')} UTC
            </span>
          </div>

          <div className="board-grid">
            <div className="board-photo">
              <PhotoMap src={run.image.src} width={run.image.width} height={run.image.height} decisions={decisions} effective={effective} selected={sel} onSelect={(id) => setSelected(id === sel ? null : id)} revealKey={p.normalizedImageSha256} />
              <div className="legend" aria-label="Legend">
                {(['leave', 'clear', 'review', 'none'] as const).map((a) => {
                  const m = ACTION_META[a];
                  return (
                    <span key={a} className="legend-item">
                      <span className={`swatch act-${a}`} aria-hidden><m.Icon size={12} /></span>
                      {m.label} <b className="mono"><CountUp value={summary[a]} /></b>
                    </span>
                  );
                })}
              </div>
              <p className="fineprint">The grid splits the photo into nine rough areas. It is not a measured map. Inspect the actual area before acting. Hover to magnify; use the arrow keys to move between patches.</p>
              {run.attribution && (
                <p className="fineprint">Photo: “{run.attribution.title}” by {run.attribution.author}, {run.attribution.place}, <a href={run.attribution.licenseUrl} target="_blank" rel="noreferrer">{run.attribution.license}</a>. {run.attribution.modifications}</p>
              )}
            </div>

            <aside className="board-side" ref={panel}>
              <AnimatePresence mode="wait">
                {sel ? (
                  <PatchInspector
                    key={sel}
                    id={sel}
                    src={run.image.src}
                    width={run.image.width}
                    height={run.image.height}
                    original={run.observations.find((o) => o.id === sel)!}
                    effective={effective.find((o) => o.id === sel)!}
                    decision={decisions.find((d) => d.id === sel)!}
                    correction={corrections.find((c) => c.id === sel)}
                    onCorrect={(c) => correct(sel, c)}
                    onClose={() => setSelected(null)}
                  />
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {ctx.concerns !== 'none' && held > 0 && (
                      <div className="hold">
                        <span><b>{held} leafy {held === 1 ? 'patch is' : 'patches are'} on hold.</b> {ctx.concerns === 'yes' ? 'You reported a site concern, so nothing is marked “leave”.' : 'Any known plant disease, fire restrictions, or other site concerns?'}</span>
                        {ctx.concerns === 'not_sure' && (
                          <div className="seg">
                            <button type="button" className="chip" onClick={() => setCtx({ ...ctx, concerns: 'none' })}>None known</button>
                            <button type="button" className="chip" onClick={() => setCtx({ ...ctx, concerns: 'yes' })}>Yes</button>
                          </div>
                        )}
                      </div>
                    )}
                    <ChoreLedger decisions={decisions} />
                    <ActionList decisions={decisions} selected={sel} onSelect={setSelected} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="toolbar">
                <GlowButton size="sm" variant="ghost" magnetic={false} onClick={exportJson}><Download size={15} aria-hidden /> Export JSON</GlowButton>
                <GlowButton size="sm" variant="ghost" magnetic={false} onClick={() => window.print()}><Printer size={15} aria-hidden /> Print plan</GlowButton>
                <GlowButton size="sm" variant="quiet" magnetic={false} onClick={() => reset(true)}><RotateCcw size={15} aria-hidden /> Start over</GlowButton>
                <label className="check small"><input type="checkbox" checked={withSign} onChange={(e) => setWithSign(e.target.checked)} /> Include a yard sign page</label>
              </div>
            </aside>
          </div>
          <PrintPlan run={run} decisions={decisions} effective={effective} ctx={ctx} withSign={withSign} />
        </motion.div>
      )}
      {burst.layer}
    </section>
  );
};
