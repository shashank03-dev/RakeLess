# RakeLess 🍂

**Photograph your autumn yard. RakeLess shows which leaves you can leave alone and which spots still need clearing.**

Fallen leaves in garden beds and under trees give shelter to insects and the birds that eat them. Leaves on a path still need clearing. RakeLess splits one photo into nine patches and tells you which is which, and why.

> Every result is a suggestion from a photo. Look at the actual spot before you act.

---

## How it works (in 30 seconds)

```
your photo ──► server cleans it up ──► Gemma 4 looks at 9 patches ──► answer is checked ──► 8 plain rules ──► your map
                (rotate, resize,          (labels only:                (exactly 9 cells,      (run in your
                 strip metadata)           surface, leaves,             valid labels)          browser)
                                           visibility)
```

1. **Gemma 4 only looks.** For each patch, the open-weight model labels what it sees: the surface (bed, lawn, path…), whether leaves are on the ground, and whether the view is clear. It gives no advice.
2. **Rules decide.** Eight short rules in `shared/rules.ts` turn those labels into one of four results:

   | Map mark | Meaning |
   |---|---|
   | 🍃 **Leave for now** | Leaves on a bed or under trees. Consider leaving them. |
   | 👣 **Clear access** | Leaves on a path or steps. Keep it usable. |
   | ❓ **Review closely** | Lawn, mixed, unclear, or you have a site concern. |
   | — **No leaf task** | No leaves on the ground. |

3. **You can correct it.** If the model mislabels a patch, fix it. The plan updates instantly, without a second AI call. Your original and corrected values are both kept.
4. **Every suggestion links its source** (NWF, Penn State Extension, UMN Extension, Nassauer).

---

## Run it locally

You need **Node 20.19+** (or 22.12+) and a **Gemini API key**, which serves Gemma.

```bash
npm install
cp .env.example .env      # then put your key in .env
export $(cat .env | xargs) # or set GEMINI_API_KEY however you like
npm run dev               # UI → http://127.0.0.1:5173  (API on 127.0.0.1:8787)
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server + local API (both on loopback) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serves `dist/` and the API from one origin on port 8787 |
| `npm test` | 37 tests: rules, schema, grid, image handling, API errors |
| `npm run typecheck` | TypeScript check |
| `npm run record-example -- <photo.jpg>` | Re-record the bundled example from a **real** model run |

No key? The page still loads, and **“See a recorded example”** still works. Only new photo analysis is disabled, and the header says so.

---

## Deploy to Vercel

1. Import this repo in Vercel. `vercel.json` sets everything up: Vite build, the `api/` functions, and security headers.
2. Add the environment variable **`GEMINI_API_KEY`** (mark it **Sensitive**) for Production and Preview.
3. Deploy.

Optional variables: `GEMMA_MODEL` (default `gemma-4-26b-a4b-it`), `RATE_PER_IP_10MIN` (default 6), `DAILY_MODEL_CALLS` (default 400), `MODEL_TIMEOUT_MS` (default 40000).

---

## API key design

The key costs money and quota, so it is guarded in layers:

```
Browser ──(same-origin only)──► /api/analyze ──► [cache] ──► [rate limits] ──► [one call at a time] ──► Gemini API
                                    │                                                                   ▲
                                    └── key lives ONLY here, in a server env var ────────────────────────┘
```

| Layer | What it does | Where |
|---|---|---|
| **Key stays on the server** | It is read only from `process.env.GEMINI_API_KEY` and never sent to the browser. There is no `VITE_` prefix, and the client never chooses the model. | `server/inference.ts` |
| **Same-origin check** | Analysis requests from other websites are refused (403), so other sites can't spend your key through their visitors. | `server/guard.ts` |
| **Validate before spending** | Size, file type, decoded format, pixel count and context are all checked *before* any model call. Bad uploads cost nothing. | `server/image.ts`, `server/handlers.ts` |
| **Cache** | The same photo with the same model and prompt returns the stored answer, labeled `CACHED`, and makes no new call. | `server/guard.ts` |
| **Per-visitor limit** | 6 new photos per 10 minutes per IP (429). Corrections are free because they never call the model. | `server/guard.ts` |
| **Daily budget** | A hard cap on model calls per day per server instance (429). The recorded example keeps working. | `server/guard.ts` |
| **One call at a time** | A second request while one is running gets 409 "busy" instead of piling up. | `server/guard.ts` |
| **Bounded calls** | 40 s timeout per attempt, a 60 s function ceiling, at most 1 retry, and a token cap of 1,800 output tokens. | `server/inference.ts`, `vercel.json` |
| **Cheap health check** | `/api/health` checks the model with a metadata request (no tokens), cached for 5 minutes. | `server/inference.ts` |
| **Free demo path** | The landing page and the recorded example use a saved real run, so visiting the site costs nothing. | `data/example-run.json` |

In-memory limits apply per serverless instance. For a hard global cap, also add a rate-limit rule in the Vercel Firewall (for example, 20 requests a minute to `/api/analyze`). Set a budget alert in Google AI Studio too.

**Rotate a key that has ever been pasted into chat, an issue, or a commit.**

---

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | App readiness and model readiness, reported separately |
| `POST /api/analyze` | Multipart: `image` (JPEG/PNG/WebP ≤ 8 MB, ≤ 20 MP) + `context` (JSON). Returns the normalized image, nine observations and provenance |
| `GET /api/examples/fallen-leaves` | The bundled recorded run (`mode: "recorded"`) |

Errors are always JSON: `400` bad upload, `403` cross-origin, `409` busy, `413` too large, `429` rate limit, `502` invalid model output after a retry, `503` model not configured, `504` timeout. An error never returns sample results.

---

## Project layout

```
api/            Vercel functions (thin wrappers)
server/         image normalization, Gemma call, spend guards, handlers, local server
shared/         schema (Zod), grid geometry, rules, sources (used by server AND browser)
src/            React app (photo map, inspector, corrections, print view)
data/           recorded real example run
tests/          Vitest
```

---

## Measured, not claimed

- **Model:** `gemma-4-26b-a4b-it` (Gemma 4 open weights, hosted by the Gemini API), temperature 0, structured JSON output.
- **Recorded example:** a real run on 2026-10-22, 16.7 s including one retry. Result: C1 and C2 (leaf-covered ground) were marked **leave for now**, C3 (gravel lane) was marked **clear access**, and the six canopy/trunk cells were marked **no leaf task**.
- **Second test** (a rotated, tighter crop of the same scene): 13.8 s. Seven patches were sent to *review* while site concerns were unresolved. The overlay stayed aligned after the EXIF rotation.
- **Known model mistakes:** C1 includes a strip of lawn by the shed, but the model labeled it *bed / tree base*. B3 includes part of the lane and a grass verge, but the model labeled it *no leaves*. You can fix both in the inspector.
- Nine cells from two photos is **not** a measure of accuracy.

## What it can't do

It cannot measure leaf depth, spot disease or pests, know your local fire or leaf rules, tell whether animals live there, judge path safety, or measure area. The 3×3 grid is a rough split of the photo, not a survey. The rules were written for **temperate North American autumn yards**. Outside that scope, everything leafy becomes review-only.

## Hosted vs. local

The original plan ran Gemma locally through Ollama. This deployment runs the same open-weight Gemma 4 model through the Gemini API, so it works on Vercel. That means **photos are sent to Google's API for the one model call**. RakeLess itself stores nothing, but this is not on-device inference. To keep photos fully local, point `server/inference.ts` at a local runtime.

## License

MIT for the code. The example photo is CC BY 2.0 (see [ATTRIBUTION.md](ATTRIBUTION.md)).
