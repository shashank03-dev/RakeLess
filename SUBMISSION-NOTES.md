# Submission notes — DEV Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady

Deadline: **October 25, 2026, 11:59 p.m. PDT** (Oct 26, 12:29 p.m. IST). Check the tag feed again before publishing.

Possible title: **"I built an AI that told me to leave the leaves alone"**. Use first person only for things you actually did.

## What I Built
RakeLess: one photo of an autumn yard becomes a 3×3 map. Each patch is marked *leave for now*, *clear access*, *review closely*, or *no leaf task*, with the model's visible evidence and a cited source. You can correct the model, and the plan updates without another AI call.

## Demo
- Live site: <add Vercel URL>
- Video: follow DEMO-SCRIPT.md

## Code
<add GitHub URL>. MIT licensed.

## How I Built It (facts you can use)
- Gemma 4 (`gemma-4-26b-a4b-it`) via the Gemini API, temperature 0, with a JSON response schema. The prompt sends the gridded photo **plus nine labeled crops** in one call, so the model looks at each cell closely.
- Zod checks the shape of the response: exactly nine unique cells with valid labels. This is a shape check, not proof that the labels are right.
- Eight pure rules in `shared/rules.ts`, run in the browser, so corrections are instant and free.
- Vercel functions with sharp handle image normalization (EXIF rotation, metadata stripping, 1536 px cap).
- Spend guards for the API key: same-origin check, cache, per-IP limit, daily cap, one call at a time, timeouts (see the README).
- Measured: recorded run 16.7 s with one retry; second test 13.8 s. Model mistakes seen: C1 (a lawn strip labeled as bed) and B3 (lane and verge labeled "no leaves").

## Why Does Open Innovation Matter?
Open weights mean the model choice can be reproduced and could run on your own machine. The prompt and rules are in the repo, where anyone can read and argue with them. Be honest that this deployment uses Google's hosted API for convenience, so photos do leave the device for one call. Hardware, electricity and downloads still cost something.

## Prize categories
Overall + **Best Use of Gemma** (Gemma is what actually runs). A submission can win only once.

## Don't claim
Hours saved, animals helped, accuracy, certification, offline/local inference for the hosted version, or originality guarantees.
