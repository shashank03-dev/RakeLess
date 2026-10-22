import { ClipboardList } from 'lucide-react';
import { PATCH_IDS, type PatchId } from '../../shared/schema';
import type { Receipt, ReceiptLine } from '../../shared/receipt';
import { ACTION_META, MATERIAL_LABEL, SURFACE_LABEL } from '../lib/actions';

const FIELD_LABEL: Record<string, (v: string) => string> = {
  surface: (v) => SURFACE_LABEL[v as keyof typeof SURFACE_LABEL] ?? v,
  material: (v) => MATERIAL_LABEL[v as keyof typeof MATERIAL_LABEL] ?? v,
  visibility: (v) => (v === 'clear' ? 'seen clearly' : 'unclear'),
  siteConcern: (v) => (v === 'true' ? 'site concern' : 'no concern'),
};

/** The user's own plan: which patches they intended to clear. Nothing is preselected. */
export function PlanPicker({ intended, onToggle }: { intended: PatchId[]; onToggle: (id: PatchId) => void }) {
  return (
    <div className="plan-picker">
      <p className="plan-q" id="plan-q">Which patches were you planning to clear? <span className="fineprint">Optional. Tap to mark.</span></p>
      <div className="plan-grid" role="group" aria-labelledby="plan-q">
        {PATCH_IDS.map((id) => (
          <button key={id} type="button" className={`plan-cell mono ${intended.includes(id) ? 'on' : ''}`} aria-pressed={intended.includes(id)} onClick={() => onToggle(id)}>
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}

function Line({ l, onSelect }: { l: ReceiptLine; onSelect: (id: PatchId) => void }) {
  const meta = ACTION_META[l.decision.action];
  return (
    <li className="rc-line">
      <button type="button" className="rc-id mono" onClick={() => onSelect(l.id)} aria-label={`Open patch ${l.id}`}>{l.id}</button>
      <div className="rc-body">
        <span className={`rc-act tone-${meta.tone}`}><meta.Icon size={12} aria-hidden /> {l.decision.title}</span>
        <span className="rc-why">
          Saw: {SURFACE_LABEL[l.final.surface]}, {MATERIAL_LABEL[l.final.material].toLowerCase()}, {l.final.visibility === 'clear' ? 'clear view' : 'unclear view'} · rule {l.decision.ruleId}
          {l.changes.length > 0 && <> · <b>your correction:</b> {l.changes.map((c) => `${FIELD_LABEL[c.field](c.from)} → ${FIELD_LABEL[c.field](c.to)}`).join(', ')}</>}
          {!l.intended && l.bucket === 'keep_access' && <> · not in your plan</>}
        </span>
      </div>
    </li>
  );
}

function Group({ title, note, lines, onSelect, tone }: { title: string; note: string; lines: ReceiptLine[]; onSelect: (id: PatchId) => void; tone: string }) {
  return (
    <section className={`rc-group tone-${tone}`}>
      <h4><span>{title}</span> <b className="mono">{lines.length}</b></h4>
      <p className="fineprint">{note}</p>
      {lines.length > 0 && <ul>{lines.map((l) => <Line key={l.id} l={l} onSelect={onSelect} />)}</ul>}
    </section>
  );
}

export function ChoreReceipt({ receipt, intended, onToggle, onSelect }: { receipt: Receipt; intended: PatchId[]; onToggle: (id: PatchId) => void; onSelect: (id: PatchId) => void }) {
  const r = receipt;
  return (
    <div className="receipt" aria-labelledby="receipt-title">
      <div className="receipt-head">
        <ClipboardList size={16} aria-hidden />
        <h3 id="receipt-title" className="mono">Chore receipt</h3>
      </div>
      <PlanPicker intended={intended} onToggle={onToggle} />
      {r.intendedCount === 0 ? (
        <p className="fineprint receipt-empty">Mark the patches you meant to clear and the receipt compares them with the plan. RakeLess does not guess your plan.</p>
      ) : (
        <>
          <p className="receipt-sum">
            You planned <b>{r.intendedCount}</b>. Worth reconsidering: <b>{r.reconsider.length}</b>. Inspect first: <b>{r.inspect.length}</b>. No leaf task seen: <b>{r.noTask.length}</b>.
          </p>
          <Group tone="moss" title="Planned cleanup worth reconsidering" lines={r.reconsider} onSelect={onSelect}
            note="Suggestion only: walk the patch first. The photo does not show leaf depth, plant health, or local rules." />
          <Group tone="amber" title="Inspect before deciding" lines={r.inspect} onSelect={onSelect}
            note="Unclear, mixed, lawn, out-of-scope, or site-concern patches. Review is not a hidden yes or no." />
          <Group tone="stone" title="No leaf task observed" lines={r.noTask} onSelect={onSelect}
            note="Nothing to rake was seen here, so it is not counted as work saved." />
        </>
      )}
      <Group tone="brick" title="Access work to keep" lines={r.keepAccess} onSelect={onSelect}
        note="Leaves on paths or steps stay on the list, planned or not." />
      {r.otherReview.length > 0 && <p className="fineprint">Also flagged for review, outside your plan: {r.otherReview.join(', ')}.</p>}
      {!r.inScope && <p className="fineprint warn-text">Outside the temperate North American autumn scope, so no patch is marked “leave”.</p>}
      <p className="fineprint">Counts are grid cells, not area or time. No minutes, money, or ecological benefit are inferred.</p>
    </div>
  );
}
