import { useEffect, useState } from 'react';
import { getHealth, type Health } from '../lib/api';

export type HealthState = Health | null | 'error';

export function useHealth() {
  const [h, setH] = useState<HealthState>(null);
  useEffect(() => {
    let live = true;
    getHealth().then((x) => live && setH(x)).catch(() => live && setH('error'));
    return () => { live = false; };
  }, []);
  return h;
}

export function ModelStatus({ health }: { health: HealthState }) {
  const state = health === null ? 'checking' : health === 'error' ? 'down' : health.model.ready ? 'ready' : 'down';
  const label = state === 'checking' ? 'Checking model…'
    : state === 'ready' ? (health as Health).model.name
    : health === 'error' ? 'API unreachable' : `Model unavailable`;
  const title = health && health !== 'error' ? `${health.model.provider}${health.model.reason ? ` — ${health.model.reason}` : ''}` : undefined;
  return (
    <span className={`status status-${state}`} title={title} role="status">
      <span className="status-dot" aria-hidden />
      <span className="mono">{label}</span>
    </span>
  );
}
