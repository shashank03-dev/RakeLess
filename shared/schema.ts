import { z } from 'zod';

export const PATCH_IDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'] as const;
export const SURFACES = ['bed_or_tree_base', 'lawn', 'path_or_steps', 'mixed', 'unknown'] as const;
export const MATERIALS = ['fallen_leaves', 'no_relevant_leaves', 'mixed_or_unclear'] as const;
export const VISIBILITIES = ['clear', 'unclear'] as const;
export const ACTIONS = ['leave', 'clear', 'review', 'none'] as const;

export const PatchId = z.enum(PATCH_IDS);
export const Surface = z.enum(SURFACES);
export const Material = z.enum(MATERIALS);
export const Visibility = z.enum(VISIBILITIES);
export const Action = z.enum(ACTIONS);

export type PatchId = z.infer<typeof PatchId>;
export type Surface = z.infer<typeof Surface>;
export type Material = z.infer<typeof Material>;
export type Visibility = z.infer<typeof Visibility>;
export type Action = z.infer<typeof Action>;

export const Observation = z.object({
  id: PatchId,
  surface: Surface,
  material: Material,
  visibility: Visibility,
  evidence: z.string().trim().min(1).max(160),
});
export type Observation = z.infer<typeof Observation>;

/** Exactly nine observations, one per patch ID. Structure only — not truth. */
export const VisionResult = z
  .object({ observations: z.array(Observation).length(9) })
  .superRefine((v, ctx) => {
    const seen = new Set(v.observations.map((o) => o.id));
    for (const id of PATCH_IDS) {
      if (!seen.has(id)) ctx.addIssue({ code: 'custom', message: `missing cell ${id}` });
    }
  })
  .transform((v) => ({
    observations: [...v.observations].sort((a, b) => PATCH_IDS.indexOf(a.id) - PATCH_IDS.indexOf(b.id)),
  }));
export type VisionResult = z.infer<typeof VisionResult>;

export const Context = z
  .object({
    region: z.enum(['temperate_na', 'other', 'unsure']),
    season: z.enum(['autumn', 'other']),
    concerns: z.enum(['none', 'yes', 'not_sure']),
  })
  .strict();
export type Context = z.infer<typeof Context>;

export const DEFAULT_CONTEXT: Context = { region: 'temperate_na', season: 'autumn', concerns: 'not_sure' };

export const Correction = z
  .object({
    id: PatchId,
    surface: Surface.optional(),
    material: Material.optional(),
    siteConcern: z.boolean().optional(),
  })
  .strict();
export type Correction = z.infer<typeof Correction>;

export type Decision = {
  id: PatchId;
  action: Action;
  title: string;
  detail: string;
  ruleId: string;
  sourceIds: string[];
  basis: 'model' | 'user';
};

export type Provenance = {
  mode: 'live' | 'recorded' | 'manual-test';
  provider: string;
  modelName: string;
  modelVersion: string | null;
  promptVersion: string;
  rulesVersion: string;
  normalizedImageSha256: string;
  timestampUtc: string;
  durationMs: number;
  retryCount: number;
  cacheHit: boolean;
};

export type AnalyzeResponse = {
  image: { width: number; height: number; src: string };
  observations: Observation[];
  provenance: Provenance;
};

/** Gemini/OpenAPI-subset schema handed to the model. Mirrors Observation. */
export const MODEL_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    observations: {
      type: 'ARRAY',
      minItems: 9,
      maxItems: 9,
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', enum: [...PATCH_IDS] },
          surface: { type: 'STRING', enum: [...SURFACES] },
          material: { type: 'STRING', enum: [...MATERIALS] },
          visibility: { type: 'STRING', enum: [...VISIBILITIES] },
          evidence: { type: 'STRING', maxLength: 160 },
        },
        required: ['id', 'surface', 'material', 'visibility', 'evidence'],
        propertyOrdering: ['id', 'surface', 'material', 'visibility', 'evidence'],
      },
    },
  },
  required: ['observations'],
} as const;
