# RakeLess evaluation

A small, reproducible check of the whole pipeline (model labels → rules → action) on photos the
model had not seen during development. It is a **proxy evaluation**, not an accuracy benchmark.

## Scenes

`manifest.json` lists **7** distinct photos from Wikimedia Commons (target was 8–12; Commons rate-limited
further downloads during this session, so the set is smaller). None is a crop, flip, or rotation of another
scene or of the bundled example. For each: source page, author, license, the exact file used (a
Wikimedia-generated thumbnail, otherwise unmodified), and its SHA-256 (the harness refuses a file that
does not match).

| Scene | Covers | Documented context |
|---|---|---|
| e01 | lawn, sidewalk, tree base, mixed cells, canopy | New Jersey, November → in scope |
| e02 | driveway close-up, out-of-focus top row | Maryland, autumn → in scope |
| e03 | stone garden steps, planted beds, ground hidden by foliage | England, no season stated → out of scope |
| e04 | woodland leaf litter (bed / tree base) | England → out of scope |
| e05 | wet sidewalk with leaves, sky and buildings | Italy, autumn → out of scope |
| e06 | dark close-up of a leaf pile, surface hidden | London, autumn → out of scope |
| e07 | woodland floor in January, trunks | England, January → out of scope |

Region and season come from each photo's own title or description, never from how it looks.
Site concerns are set to "none known" for every scene. Because only two scenes are in scope,
the harness also reports an **in-scope counterfactual**: the same labels run through the rules as if
the photo were a temperate North American autumn yard. That exercises the leave/clear rules on more
ground cells; it does not claim the guidance applies to those places.

## Reference labels

An AI coding agent (the one that built this evaluation) viewed each photo at 1024 px with the 3×3 grid
drawn on it and wrote one reference observation per cell (surface, material, visibility). The labels were
committed (`git log -- eval/manifest.json`) **before** any model ran on these photos, and they were not
edited after seeing outputs. They are not expert ground truth: several cells are genuinely ambiguous
(for example whether a cell is "mixed" or mostly path), and the notes field says so. Reference *actions*
are computed by running the same rules over the reference labels.

## Development vs. evaluation

- **Development:** the bundled example (`public/examples/fallen-leaves.jpg`) was used to pick the local
  model tag (`gemma4:e2b` labelled every cell "mixed/unclear"; `gemma4:e4b` was usable). The prompt was not
  changed during this work.
- **Evaluation:** the seven scenes above, each run once per configuration. No prompt or rule changes were
  made in response to their results.

## Metrics (all reported as n / d)

- **Schema success:** runs that returned a valid nine-cell structure (after at most one retry).
- **Observation agreement:** surface, material and visibility vs. the reference, for all cells and for
  *ground cells* only (cells whose reference is not "no ground / no leaves", so canopy and sky do not
  inflate the numbers).
- **Action agreement:** model-derived action vs. reference-derived action under the documented context and
  under the in-scope counterfactual. "Review" agreeing with "review" counts as agreement; a review where the
  reference says leave/clear counts as a miss, not as a safe success.
- **Review rate:** share of cells the model's labels sent to review.
- **Actionable coverage:** of the cells whose reference action is leave or clear, how many the model got to
  the same action.
- **Critical confusions:** the model says *leave* where the reference says something else, or *no task*
  where the reference has a task or a review.
- **Time:** wall time per scene (normalization + inference + retries) and inference time.
  The evaluation calls the model directly, without the cache, so every number is a fresh call.

## Run it

```bash
RAKELESS_PROVIDER=ollama OLLAMA_MODEL=gemma4:e4b npm run eval -- --split evaluation
GEMINI_API_KEY=... npm run eval -- --split evaluation      # hosted (not run in this session: no key)
```

Results are written to `eval/results/<date>-<provider>-<model>.json` with per-cell reference, model labels,
evidence, rule and action.

## Results: local `gemma4:e4b` (Ollama, CPU), 2026-10-22

File: `results/2026-10-22-ollama-gemma4_e4b.json`. Model digest `sha256:dc35e8d9…`, Q4_K_M, prompt
`prompt-2026-10-22.3`, rules `rules-2026-10-22.2`. Hardware: 4-core x86 CPU container, 15 GB RAM, no GPU.
Other work (tests, a production build) ran on the same machine during the run, so times are indicative only.

| | Result |
|---|---|
| Valid nine-cell structure | **7 / 7** scenes, 7 upstream calls, 0 retries, 0 failures |
| Wall time per photo | 95, 105, 114, 124, 128, 129, 226 s (median 124 s) |
| Inference time | within 1.3 s of wall time for every scene |
| Surface agreement, ground cells | 13 / 49 (27 %) |
| Material agreement, ground cells | 30 / 49 (61 %) |
| Visibility agreement, ground cells | 23 / 49 (47 %) |
| Model review rate, all cells | **61 / 63 (97 %)** |
| Action agreement, documented context | 39 / 63 all cells; 39 / 49 ground cells |
| Actionable coverage, documented context | **1 / 7** (reference leave/clear cells the model reached) |
| Action agreement, in-scope counterfactual | 20 / 63 all cells; 20 / 49 ground cells |
| Actionable coverage, in-scope counterfactual | **1 / 26** |
| Critical confusions (model *leave* or *no task* where the reference differs) | **0 / 63** in both contexts |

### What this says

- **The pipeline is safe in the narrow sense and not yet useful.** The small local model almost always
  produced labels that the rules route to review. That is why there are no critical confusions, and also
  why it reached the reference action for only 1 of 7 actionable cells. Review is counted as a miss here,
  not as a success.
- **Most "agreement" under the documented context is review agreeing with review**, because five of seven
  scenes are outside the rules' region or season. The ground-cell and counterfactual rows are the more
  informative ones.
- **One overconfident call:** in e01, cell B3 mixes lawn, the start of a sidewalk and the driveway
  (reference: mixed → review). The model said "path with leaves" → *clear access*. Not harmful, but extra work.

### Concrete failures

- **e01, top row:** tree canopy cells (A1–A3) were labelled "lawn, fallen leaves" with evidence such as
  "The grass shows scattered fallen leaves." The rules sent them to review, so no wrong advice resulted,
  but a user has to dismiss three phantom chores. Correcting "on the ground" to *No leaves on ground*
  turns each into *no leaf task* without another model call (shown in the demo).
- **e02:** a sharp close-up of a driveway was "unknown / unclear / unclear" in all nine cells
  ("The surface in this cell is unclear."). A user can correct the surface to path/steps and confirm they
  looked, which yields *clear access* (R3).
- **e03 and e07:** the model repeated one boilerplate sentence for every cell, a sign that it did not
  use the per-cell crops. **e04:** uniform leaf litter was called "mixed" in all nine cells, so no *leave*
  suggestion was possible even in the counterfactual.

### Not measured

- **Hosted Gemma (`gemma-4-26b-a4b-it`)** was not evaluated: no Gemini API key was available in this session.
  The only hosted evidence is the bundled recorded example and earlier runs on transforms of that one
  scene, which are not independent. Run `GEMINI_API_KEY=... npm run eval` to fill this gap.
- Seven scenes, agent-written references, one run each: enough to find failure modes, not to estimate accuracy.

