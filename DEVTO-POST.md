---
title: RakeLess: a receipt for the raking you were about to do
published: false
tags: devchallenge, hf26challenge, opensource, gemma
cover_image: https://raw.githubusercontent.com/shashank03-dev/RakeLess/main/docs/screenshots/hero.jpg
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

Autumn yard work starts with a plan that's mostly habit: rake everything. Some of it is real work, like leaves on the steps you walk down every morning. Some of it you could skip. Penn State Extension notes that leaves in garden beds can stay where they fall to insulate roots, and the National Wildlife Federation describes the leaf layer as foraging ground and nesting material for birds.

**RakeLess** takes one ground-level photo of a yard and splits it into a 3×3 grid. You mark the patches you were planning to clear. It hands back a **chore receipt**:

- **Planned cleanup worth reconsidering:** leaves on a bed or under trees, seen clearly, with no site concerns.
- **Access work to keep:** leaves on a path or steps, whether you planned it or not.
- **Inspect before deciding:** lawns (a photo can't show how thick the layer is), mixed or unclear patches, anything outside the rules' scope.
- **No leaf task observed:** nothing on the ground, so it doesn't count as work saved.

Every line shows what the model saw, which rule fired, and any correction you made. The counts are grid cells. RakeLess doesn't turn them into square metres, minutes, or "birds helped".

The lazy part is the point: do the clearing that matters, skip some of the rest, and have a written reason for each patch you skip.

## Demo

- **Live (hosted Gemma):** https://rakeless.vercel.app. The landing page replays a saved real run, labelled `RECORDED REPLAY · not a new model call`. New photos go to Google's Gemini API, and the page says so before you upload.
- **Local run with the network cut off:** [`eval/results/OFFLINE.md`](https://github.com/shashank03-dev/RakeLess/blob/main/eval/results/OFFLINE.md). Ollama and the RakeLess server ran inside a Linux network namespace with only loopback. The page records the network probe, the health check (provider, model digest), the single Ollama request, and the API response: live, uncached, 112.6 s.

I also tried to record a captioned browser video of that local run. It didn't work on a 4-core VM: video capture slowed inference about tenfold, and all four attempts timed out (the first at our own 280 s cap, the rest at Ollama's ~5 minute request limit). The failed runs are in the same folder.

## Code

{% github shashank03-dev/RakeLess %}

MIT licensed. `npm test` covers the rules (including all 1,080 combinations of context and labels), the receipt, the model contract, the request deadline and retries, cache expiry, readiness recovery, and the provider HTTP contracts with mocks. `npm run eval` reruns the evaluation below.

## How I Built It

**The model only looks. Plain rules decide.**

```text
photo → server: decode, rotate, strip EXIF, 3×3 grid + 9 crops
      → Gemma labels each cell: surface · leaves on ground · visibility · one sentence of evidence
      → Zod: exactly nine valid cells (server and browser)
      → 9 ordered rules → map + chore receipt → you correct → rules re-run, no new model call
```

Gemma never gives advice. For each cell it picks from fixed labels: surface (bed/tree base, lawn, path/steps, mixed, unknown), fallen leaves (yes, no, unclear), and visibility (clear, unclear). Nine rules in `shared/rules.ts` turn those labels into *leave for now*, *clear access*, *review*, or *no leaf task*. The same file runs on the server and in the browser, so a correction is instant.

**A bug that shaped the rules.** An earlier version checked "is it a path with leaves?" before "is the photo clear?". So a blurry patch the model *thought* was a path became a confident "clear this". Uncertainty now runs first: unclear, mixed, or unknown patches go to review before any other rule. A test enumerates every combination and asserts that *leave*, *clear*, and *no task* only appear where the rules allow them.

**Two providers, one contract.** A small provider interface has two implementations:

- **Hosted:** `gemma-4-26b-a4b-it` through the Gemini API. This is what the Vercel demo uses.
- **Local:** any vision-capable Gemma tag in Ollama. I used `gemma4:e4b`.

Both receive the same gridded overview plus nine labelled crops. Both are validated by the same Zod schema and feed the same rules. The server picks the provider; the browser can't. There is no silent fallback from local to cloud. Each result records the provider, the model, the version (or the Ollama manifest digest for local runs), the prompt and rules versions, the image hash, model time, server time, the number of upstream calls, and cache status.

**Fixing the failure paths:**

- One deadline covers each request: 52 s on Vercel, inside the 60 s function limit. A retry only happens for invalid JSON or a transient error, and only if at least 10 s remain. Every retry counts against the daily budget.
- If the browser goes away, the upstream call is aborted.
- The readiness check describes the selected model provider, not just the web server. It retries with backoff and has a "Check again" button, so one slow probe no longer disables analysis until you reload.
- The old cache kept whole responses, base64 photos included, with no expiry. Now it keeps only the nine labels for at most 10 minutes. The privacy copy describes exactly that, including where Google's API terms apply.

## What the evaluation showed

I wanted a number that couldn't come from one photo and its rotations. So I collected **seven distinct, licensed photos** from Wikimedia Commons: a New Jersey lawn and sidewalk, a Maryland driveway, English garden steps, woodland leaf litter, an Italian sidewalk, a dark leaf pile, and a woodland floor in January. I aimed for 8–12, but Commons rate-limited the downloads. The coding agent wrote reference labels for every cell **before** any model saw these photos, and committed them first. These are proxy labels, not expert ground truth.

With local `gemma4:e4b` on a 4-core CPU:

| | |
|---|---|
| Valid nine-cell answers | 7 / 7, no retries |
| Time per photo | 95–226 s (median 124 s) |
| Cells sent to review | **61 / 63** |
| Reference leave/clear cells reached | **1 / 7** (1 / 26 if every photo were treated as in scope) |
| Wrong *leave* or wrong *no task* | **0 / 63** |

That's an honest middle result. The rule layer did its job: a weak model never produced confident bad advice. But a tool that sends almost everything to review is only a little lazier than raking. The failures were specific:

- **Canopy read as lawn.** On the New Jersey photo, the three tree-canopy cells came back as *"The grass shows scattered fallen leaves."* In the inspector you change "on the ground" to *No leaves on ground*, and each becomes *no leaf task* with no second model call. Correcting a cell takes one click and no model call.
- **A sharp driveway called "unclear".** On the Maryland close-up, all nine cells were unclear. Correcting the surface and confirming you looked turns them into *clear access*.
- **Boilerplate.** On two scenes the model repeated one sentence for all nine cells, so it clearly wasn't using the per-cell crops.

I couldn't evaluate hosted Gemma in this session because I had no API key, so I'm not putting a hosted accuracy or speed number here. The one saved hosted run (16.7 s, one retry) is a single scene.

## Why Does Open Innovation Matter?

What open weights changed here is concrete:

- **I could take the model off the network.** The same Gemma family that powers the hosted demo ran on a CPU with external networking disabled, and the API answered with a live, uncached result tagged with the exact weights' digest. For a photo of someone's yard, being able to say "this never left the machine" matters. It isn't free: a 6.6 GB download, two to four minutes per photo on this hardware, and electricity.
- **I could swap the model without touching the judgement.** Moving from hosted 26B to local E4B changed nothing in the rules, the receipt, or the tests. The evaluation then showed exactly what that swap cost.
- **Every judgement is readable.** The prompt, the label schema, the nine rules, and the sources behind them are in the repo. If you think lawns shouldn't always be "review", you can change R7, cite a better source, and rerun `npm run eval` on the same seven photos.

A proprietary vision API could fill the same "looks" slot. The rule layer doesn't care. What it couldn't give me is the offline run, or the chance to pin and inspect the exact weights.

## Scope and limits

The rules were written for temperate North American autumn yards. Anywhere else, every leafy patch becomes review-only. RakeLess can't measure leaf depth, spot disease or pests, know local fire or leaf rules, or judge whether a path is safe. Each cell of the 3×3 grid can mix surfaces, and when it does it's sent to review. A *leave for now* is a suggestion to walk the patch first, not a certificate.

## Credits

Photos: Michael Gil (CC BY 2.0), Famartin, Mark Schellhase, Acabashi (CC BY-SA 4.0), Anna.Massini (CC BY 4.0), McKay Savage (CC BY 2.0), and Bob Embleton (CC BY-SA 2.0), via Wikimedia Commons. Rule sources: Penn State Extension, National Wildlife Federation, University of Minnesota Extension, and Joan Nassauer's work on cues to care. They inform a prototype and don't endorse it. Built with Gemma 4, Ollama, React, Vite, Zod, and sharp, with help from an AI coding agent.

## Prize Categories

**Best Use of Gemma.** Gemma does all of the vision work, hosted through the Gemini API on the public demo, and locally through Ollama, including a run with the network cut off.
