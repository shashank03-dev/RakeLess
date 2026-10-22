import { motion } from 'motion/react';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { MATERIALS, SURFACES, type Correction, type Decision, type Material, type Observation, type PatchId, type Surface } from '../../shared/schema';
import type { EffectiveObservation } from '../../shared/rules';
import { SOURCES } from '../../shared/sources';
import { ACTION_META, MATERIAL_LABEL, SURFACE_LABEL } from '../lib/actions';
import { PatchCrop } from './PhotoMap';
import { Segmented } from '../ui/Segmented';

type Props = {
  id: PatchId;
  src: string;
  width: number;
  height: number;
  original: Observation;
  effective: EffectiveObservation;
  decision: Decision;
  correction?: Correction;
  onCorrect: (c: Correction | null) => void;
  onClose: () => void;
};

export function PatchInspector({ id, src, width, height, original, effective, decision, correction, onCorrect, onClose }: Props) {
  const meta = ACTION_META[decision.action];
  const set = (patch: Partial<Correction>) => {
    const next: Correction = { ...(correction ?? { id }), ...patch, id };
    // Drop values that match the model so "corrected" stays meaningful — except a deliberate path confirmation.
    if (next.material === original.material) delete next.material;
    if (next.siteConcern === false) delete next.siteConcern;
    const empty = next.surface === undefined && next.material === undefined && next.siteConcern === undefined;
    onCorrect(empty ? null : next);
  };

  return (
    <motion.section
      key={id}
      className={`inspector tone-${meta.tone}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-labelledby="inspector-title"
    >
      <header className="inspector-head">
        <div>
          <span className="mono kicker">Patch {id}</span>
          <h3 id="inspector-title" className="inspector-title">
            <meta.Icon size={20} aria-hidden /> {decision.title}
          </h3>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close patch details"><X size={18} /></button>
      </header>

      <PatchCrop src={src} width={width} height={height} id={id} />

      <p className="inspector-detail">{decision.detail}</p>

      <div className="observed">
        <div className="observed-row">
          <span className="mono label">Model saw</span>
          <q>{original.evidence}</q>
        </div>
        <dl className="facts">
          <div><dt>Surface</dt><dd>{SURFACE_LABEL[original.surface]}</dd></div>
          <div><dt>Ground</dt><dd>{MATERIAL_LABEL[original.material]}</dd></div>
          <div><dt>Visibility</dt><dd>{original.visibility}</dd></div>
        </dl>
        <p className="fineprint">Observation, not proof. Structure was validated; the content was not verified.</p>
      </div>

      <fieldset className="correct">
        <legend>Correct what the model saw <span className="fineprint">— no new photo is sent</span></legend>
        <div className="seg-label">Surface</div>
        <Segmented name={`surface-${id}`} label="Surface" size="sm" value={effective.surface} userValue={correction?.surface}
          options={SURFACES.map((v) => ({ v, label: SURFACE_LABEL[v] }))} onChange={(v: Surface) => set({ surface: v })} />
        {effective.surface === 'path_or_steps' && !correction?.surface && (
          <button type="button" className="link-btn" onClick={() => set({ surface: 'path_or_steps' })}>Confirm this is a path I use</button>
        )}
        <div className="seg-label">On the ground</div>
        <Segmented name={`material-${id}`} label="Material" size="sm" value={effective.material} userValue={correction?.material}
          options={MATERIALS.map((v) => ({ v, label: MATERIAL_LABEL[v] }))} onChange={(v: Material) => set({ material: v })} />
        <label className="check">
          <input type="checkbox" checked={!!correction?.siteConcern} onChange={(e) => set({ siteConcern: e.target.checked })} />
          <span>Known plant disease or other concern in this patch</span>
        </label>
        {correction && (
          <button type="button" className="link-btn" onClick={() => onCorrect(null)}>
            <RotateCcw size={14} aria-hidden /> Restore the model’s observation
          </button>
        )}
      </fieldset>

      {decision.sourceIds.length > 0 && (
        <div className="why">
          <span className="mono label">Why · rule {decision.ruleId}</span>
          {decision.sourceIds.map((sid) => {
            const s = SOURCES[sid];
            return (
              <a key={sid} className="source-card" href={s.url} target="_blank" rel="noreferrer">
                <span className="source-pub">{s.publisher}</span>
                <span className="source-sum">{s.summary}</span>
                <span className="source-link">{s.title} <ExternalLink size={12} aria-hidden /></span>
              </a>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
