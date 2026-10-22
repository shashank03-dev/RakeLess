import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth, type Health } from '../lib/api';

/**
 * checking: a probe is running · ready · unavailable: provider temporarily unreachable (auto-retries)
 * config: the server is misconfigured for its provider (retry won't help without an operator) · unreachable: our own API is down.
 */
export type HealthPhase = 'checking' | 'ready' | 'unavailable' | 'config' | 'unreachable';
export type HealthState = { phase: HealthPhase; health: Health | null; error: string | null; attempt: number; recheck: () => void };

const BACKOFF_MS = [2_000, 5_000, 12_000];

export function useHealth(): HealthState {
  const [health, setHealth] = useState<Health | null>(null);
  const [phase, setPhase] = useState<HealthPhase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  const ctrl = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback((n: number) => {
    if (timer.current) clearTimeout(timer.current);
    ctrl.current?.abort(); // never overlap probes; a stale answer is ignored by `id`
    const id = ++seq.current;
    const c = new AbortController();
    ctrl.current = c;
    const t = setTimeout(() => c.abort(), 8_000);
    setPhase('checking');
    setAttempt(n);
    getHealth(c.signal)
      .then((h) => {
        if (id !== seq.current) return;
        setHealth(h);
        setError(h.model.reason);
        const next: HealthPhase = h.model.status === 'ready' ? 'ready' : h.model.status === 'config_error' ? 'config' : 'unavailable';
        setPhase(next);
        if (next === 'unavailable' && n < BACKOFF_MS.length) timer.current = setTimeout(() => run(n + 1), BACKOFF_MS[n]);
      })
      .catch(() => {
        if (id !== seq.current) return;
        setPhase('unreachable');
        setError(c.signal.aborted ? 'The health check timed out.' : 'The RakeLess API could not be reached.');
        if (n < BACKOFF_MS.length) timer.current = setTimeout(() => run(n + 1), BACKOFF_MS[n]);
      })
      .finally(() => clearTimeout(t));
  }, []);

  useEffect(() => {
    run(0);
    return () => { seq.current++; ctrl.current?.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [run]);

  const recheck = useCallback(() => run(0), [run]);
  return { phase, health, error, attempt, recheck };
}

export function ModelStatus({ health }: { health: HealthState }) {
  const { phase, health: h } = health;
  const label = phase === 'checking' ? 'Checking model…'
    : phase === 'ready' ? `${h!.model.name}${h!.model.local ? ' · local' : ' · hosted'}`
    : phase === 'unreachable' ? 'API unreachable'
    : phase === 'config' ? 'Model not configured' : 'Model unavailable';
  const cls = phase === 'checking' ? 'checking' : phase === 'ready' ? 'ready' : 'down';
  const title = h ? `${h.model.providerLabel}${h.model.reason ? `: ${h.model.reason}` : ''}` : undefined;
  return (
    <span className={`status status-${cls}`} title={title} role="status">
      <span className="status-dot" aria-hidden />
      <span className="mono">{label}</span>
    </span>
  );
}

/** Inline explanation plus a manual retry, shown where analysis would otherwise just be disabled. */
export function ReadinessNote({ health }: { health: HealthState }) {
  const { phase, error, recheck } = health;
  if (phase === 'ready') return null;
  const text = phase === 'checking' ? 'Checking whether the model is ready…'
    : phase === 'config' ? `The server is not set up for its model provider${error ? `: ${error}` : '.'} Retrying will not help until the operator fixes it.`
    : phase === 'unreachable' ? `${error ?? 'The RakeLess API could not be reached.'}`
    : `The model is temporarily unavailable${error ? ` (${error})` : ''}.`;
  return (
    <div className={`ctx-note ${phase === 'checking' ? '' : 'warn'} readiness`} role={phase === 'checking' ? undefined : 'alert'}>
      <span>{text} The recorded example still works.</span>
      {phase !== 'checking' && (
        <button type="button" className="link-btn strong" onClick={recheck}><RefreshCw size={14} aria-hidden /> Check again</button>
      )}
    </div>
  );
}
