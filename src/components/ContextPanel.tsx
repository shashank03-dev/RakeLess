import type { Context } from '../../shared/schema';
import { inScope } from '../../shared/rules';

type Opt<T extends string> = { v: T; label: string };
function Choice<T extends string>({ label, value, options, onChange, name }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void; name: string }) {
  return (
    <div className="ctx-q">
      <div className="ctx-label" id={`${name}-l`}>{label}</div>
      <div className="seg" role="radiogroup" aria-labelledby={`${name}-l`}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={`chip ${value === o.v ? 'on' : ''}`} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContextPanel({ ctx, onChange }: { ctx: Context; onChange: (c: Context) => void }) {
  return (
    <div className="ctx">
      <Choice name="concerns" label="Any known plant disease, local fire restrictions, or other site concerns?" value={ctx.concerns}
        options={[{ v: 'none', label: 'None known' }, { v: 'yes', label: 'Yes' }, { v: 'not_sure', label: 'Not sure' }]}
        onChange={(concerns) => onChange({ ...ctx, concerns })} />
      {ctx.concerns !== 'none' && (
        <p className="ctx-note">Until this is “None known”, RakeLess won’t suggest leaving any leaves. Paths can still be flagged.</p>
      )}
      <div className="ctx-row">
        <Choice name="region" label="Where is this?" value={ctx.region}
          options={[{ v: 'temperate_na', label: 'Temperate N. America' }, { v: 'other', label: 'Elsewhere' }, { v: 'unsure', label: 'Not sure' }]}
          onChange={(region) => onChange({ ...ctx, region })} />
        <Choice name="season" label="Season" value={ctx.season}
          options={[{ v: 'autumn', label: 'Autumn' }, { v: 'other', label: 'Other' }]}
          onChange={(season) => onChange({ ...ctx, season })} />
      </div>
      {!inScope(ctx) && <p className="ctx-note warn">Outside the rules’ scope: you can view the map, but every leafy patch becomes review-only.</p>}
    </div>
  );
}
