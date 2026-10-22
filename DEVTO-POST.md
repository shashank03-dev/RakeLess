---
title: I built an AI that tells you to leave the leaves alone
published: true
tags: devchallenge, hf26challenge, opensource, gemma
cover_image: https://raw.githubusercontent.com/shashank03-dev/RakeLess/main/docs/screenshots/hero.jpg
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

Every autumn there's an urge to rake everything. A lot of that work isn't needed. Leaves in garden beds and under trees shelter insects and the birds that feed on them. Leaves on a path or steps still need to go.

**RakeLess** turns one photo of your yard into a 3×3 map. Each of the nine patches gets one of four marks:

| Mark | Meaning |
|---|---|
| 🍃 **Leave for now** | Leaves on a bed or under trees. Consider leaving them. |
| 👣 **Clear access** | Leaves on a path or steps. Keep it usable. |
| ❓ **Review closely** | Lawn, mixed, unclear, or a site concern you flagged. |
| — **No leaf task** | No leaves on the ground. |

Each mark shows what the model saw in that patch and links the source behind the rule (National Wildlife Federation, Penn State Extension, University of Minnesota Extension). If the model gets a patch wrong, you correct it and the plan updates immediately, with no second AI call. You can then print the plan, with an optional "leaves left on purpose" yard sign.

It's a tool for being lazy on purpose, with a reason written down for every patch you skip.

## Demo

**Live:** https://rakeless.vercel.app

🎬 **Demo video (93 s):** https://github.com/shashank03-dev/RakeLess/blob/main/docs/rakeless-demo.mp4

The demo video was recorded **from code**: a Playwright script drives the live site, makes one real Gemma call on a photo it has never seen, and shows the uncut wait.

The landing page shows a **saved, real Gemma 4 run** on a CC BY 2.0 photo, clearly labeled "recorded run", so visiting costs nothing. The workbench below it analyses your own photo live.

## Code

{% github shashank03-dev/RakeLess %}

MIT licensed. `npm test` runs 37 tests covering the rules, the schema, the grid, image handling and API errors.

## How I Built It

The core design choice: **the model only looks. Plain rules decide.**

```text
photo -> server cleans it -> Gemma 4 labels 9 patches -> response checked -> 8 rules -> map
         (EXIF rotate,       (surface, leaves,           (Zod: exactly 9     (run in your
          strip metadata,     visibility; no advice)      unique cells)       browser)
          1536 px cap)
```

- **Model:** Gemma 4 (`gemma-4-26b-a4b-it`), open weights, at temperature 0 with a JSON response schema. The prompt sends the gridded photo **plus nine labeled crops** in a single call, so the model looks at each cell up close instead of guessing from a thumbnail.
- **Contract:** Zod checks that the answer has exactly nine unique cells with valid labels. If it doesn't, the server retries once, then returns an honest error. It never falls back to sample data. This is a shape check, not proof the labels are right.
- **Rules:** eight short, pure functions in `shared/rules.ts`. They run in the browser, so a correction is instant and free. Because the rules are code you can read, you can also argue with them.
- **Server:** Vercel functions with `sharp` for image normalization. The API key is protected by a same-origin check, a cache, a per-IP limit, a daily cap, one call at a time, and timeouts.
- **Front end:** React 19, Vite, TypeScript and `motion`. The dark "field lab" look takes cues from vibrant.design. The effects are my own reworks of Aceternity UI ideas: a dot-matrix leaf that reacts to the cursor, a before/after slider, and a tracing beam over the pipeline. Everything respects `prefers-reduced-motion`.

**Measured, not claimed.** The recorded run took 16.7 s including one retry. A second test took 13.8 s, and the live run in the demo video took 18.6 s. Gemma did make mistakes. It labeled a strip of lawn by a shed as "bed", and missed the leaves on part of a lane. That's exactly why the inspector lets you correct each patch. Nine cells from two photos say nothing about accuracy.

## Why Does Open Innovation Matter?

- **The model can be swapped or self-hosted.** RakeLess was planned around running Gemma locally with Ollama. Because the weights are open, this deployment can use the *same* model through Google's hosted API purely so it runs on Vercel. You're never locked into one provider: the model call is a single function in `server/inference.ts`, and you could point it at your own machine. To be clear, the hosted version **does send your photo to Google for one call**. RakeLess itself stores nothing, but this is not on-device inference.
- **The judgement is open too.** The prompt, the schema and all eight rules are in the repo. A gardener who disagrees with "review lawns closely" can read the rule, change it, and cite a better source. A closed "just ask the API" design would hide that judgement inside a model.
- **Reproducible.** The model name, prompt version and rules version are stamped on every result, and a script re-records the example from a real run.

## Prize Categories

**Best Use of Gemma.** Gemma 4 does all of the vision work in RakeLess.
