import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowDown, ArrowRight, Download, FlaskConical, Printer, RotateCcw, Radio } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONTEXT, type Context, type Correction, type PatchId } from '../shared/schema';
import { applyCorrections, decide, summarize } from '../shared/rules';
import exampleRun from '../data/example-run.json';
import { analyzePhoto, ApiError, getExample, type Run, type Stage } from './lib/api';
import { CountUp, Magnet, Reveal, SplitWords, Tilt, VelocityMarquee, useLeafBurst } from './lib/fx';
import { ACTION_META } from './lib/actions';
import { PhotoMap } from './components/PhotoMap';
import { PatchInspector } from './components/PatchInspector';
import { ActionList } from './components/ActionList';
import { ChoreLedger } from './components/ChoreLedger';
import { ContextPanel } from './components/ContextPanel';
import { ModelStatus, useHealth } from './components/ModelStatus';
import { Stages } from './components/Stages';
import { Dropzone } from './components/Dropzone';
import { HowItDecides } from './components/HowItDecides';
import { Limits } from './components/Limits';
import { PrintPlan } from './components/PrintPlan';

const EXAMPLE = exampleRun as unknown as Run;
const HERO_CTX: Context = { region: 'temperate_na', season: 'autumn', concerns: 'none' };

export default function App() {
  const health = useHealth();
  const workbench = useRef<HTMLElement>(null);
  const goTry = () => workbench.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const [requestExample, setRequestExample] = useState(0);

  return (
    <>
      <div className="grain" aria-hidden />
      <Nav health={health} />
      <main>
        <Hero onTry={goTry} onExample={() => { setRequestExample((n) => n + 1); goTry(); }} />
        <VelocityMarquee items={['Leave for now', 'Clear access', 'Review closely', 'No leaf task', 'Inspect before acting']} />
        <Workbench ref={workbench} requestExample={requestExample} modelReady={health !== null && health !== 'error' && health.model.ready} />
        <HowItDecides />
        <Limits />
      </main>
      <Footer />
    </>
  );
}

function Nav({ health }: { health: ReturnType<typeof useHealth> }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <a href="#top" className="wordmark" aria-label="RakeLess home">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="var(--amber)" /><path d="M4 20 13 11" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span>Rake<em>Less</em></span>
      </a>
      <nav aria-label="Sections">
        <a href="#try">Try it</a>
        <a href="#rules">How it decides</a>
        <a href="#limits">Limits</a>
      </nav>
      <ModelStatus health={health} />
    </header>
  );
}

function Hero({ onTry, onExample }: { onTry: () => void; onExample: () => void }) {
  const decisions = useMemo(() => decide(EXAMPLE.observations, HERO_CTX), []);
  const effective = useMemo(() => applyCorrections(EXAMPLE.observations, []), []);
  const s = summarize(decisions);
  const leafy = s.leave + s.clear + s.review;
  const [sel, setSel] = useState<PatchId | null>(null);
  const d = decisions.find((x) => x.id === sel);
  return (
    <section id="top" className="hero">
      <div className="hero-copy">
        <motion.span className="mono kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          Autumn field notes · temperate North America
        </motion.span>
        <h1 className="display">
          <SplitWords text="Your yard may need less tidying than you think." italic={['less']} delay={0.15} />
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}>
          Take a photo of your autumn yard. RakeLess marks which leaves you can leave alone and which spots still need clearing. Every suggestion comes with its reason.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }}>
          <Magnet><button type="button" className="btn btn-amber btn-lg" onClick={onTry}>Check my photo <ArrowRight size={18} aria-hidden /></button></Magnet>
          <Magnet><button type="button" className="btn btn-ghost btn-lg" onClick={onExample}><FlaskConical size={17} aria-hidden /> See a recorded example</button></Magnet>
        </motion.div>
        <motion.dl className="hero-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <div><dt>Leafy patches in this photo</dt><dd><CountUp value={leafy} /></dd></div>
          <div><dt>Raking chores that can wait</dt><dd className="moss"><CountUp value={s.leave} /></dd></div>
          <div><dt>Paths to still clear</dt><dd className="brick"><CountUp value={s.clear} /></dd></div>
        </motion.dl>
      </div>

      <motion.div className="hero-visual" initial={{ opacity: 0, y: 30, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3, duration: 0.9, ease: [0.2, 0.7, 0.1, 1] }}>
        <Tilt className="polaroid">
          <PhotoMap src={EXAMPLE.image.src} width={EXAMPLE.image.width} height={EXAMPLE.image.height} decisions={decisions} effective={effective} selected={sel} onSelect={(id) => setSel(id === sel ? null : id)} compact />
          <div className="polaroid-caption">
            <AnimatePresence mode="wait">
              {d ? (
                <motion.p key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <span className="mono">{d.id}</span> {d.title}. <span className="muted">{EXAMPLE.observations.find((o) => o.id === d.id)?.evidence}</span>
                </motion.p>
              ) : (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="mono rec">● REC</span> Saved real run of {EXAMPLE.provenance.modelName}. Tap a patch.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </Tilt>
        <motion.div className="hero-ledger" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9, duration: 0.6 }}>
          <ChoreLedger decisions={decisions} />
        </motion.div>
        <p className="credit">Photo: “Fallen Leaves October 2011” by Michael Gil, Ontario, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a>. Resized, grid added.</p>
      </motion.div>
      <a href="#try" className="scroll-cue" aria-label="Scroll to the workbench"><ArrowDown size={16} /></a>
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
      <Reveal className="section-head">
        <span className="mono kicker">01 — The notebook</span>
        <h2 className="h2">One photo. Nine patches. <em>A reason</em> for each one.</h2>
      </Reveal>

      <div className="steps">
        <Reveal className="step">
          <div className="step-num mono">A</div>
          <div className="step-body">
            <h3 className="h3">Your site</h3>
            <ContextPanel ctx={ctx} onChange={setCtx} />
          </div>
        </Reveal>

        <Reveal className="step" delay={0.05}>
          <div className="step-num mono">B</div>
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
                    <Magnet><button type="button" className="btn btn-amber" onClick={analyze} disabled={!modelReady}>Analyze with Gemma <ArrowRight size={16} aria-hidden /></button></Magnet>
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
                <button type="button" className="btn btn-ghost" onClick={exportJson}><Download size={16} aria-hidden /> Export JSON</button>
                <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} aria-hidden /> Print plan</button>
                <button type="button" className="btn btn-ghost" onClick={() => reset(true)}><RotateCcw size={16} aria-hidden /> Start over</button>
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

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-big" aria-hidden>Rake<em>less</em>.</div>
      <div className="footer-cols">
        <p>A small build for the DEV Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady. Gemma 4 open-weight vision, served through the Gemini API. The rules are plain TypeScript.</p>
        <p>Sources inform the prototype rules. They are not endorsements or expert review of this app. Photo credit: Michael Gil, CC BY 2.0.</p>
        <p className="mono">MIT licensed · no accounts · no tracking · photos are not stored</p>
      </div>
    </footer>
  );
}
