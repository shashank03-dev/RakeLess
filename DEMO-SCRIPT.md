# Demo script (local run, ~60 s after cutting the wait)

> **Status:** not recorded. Four attempts on a 4-core CPU VM failed because video capture starved inference (see `eval/results/OFFLINE.md`). The script below is ready for a machine with more cores or a GPU: `DEMO=1 sh scripts/offline-run.sh && sh scripts/cut-demo.sh`.

Recorded by `scripts/record-demo-local.cjs`, cut by `scripts/cut-demo.sh`. Captions are on screen; there is no voice-over.

| Segment | Screen | Caption (abridged) |
|---|---|---|
| 1 | Landing page | One photo, nine patches. The model labels; rules decide. |
| 2 | Workbench, model status | Model status names the model and the provider (Ollama on this machine). Site concerns: none known. |
| 3 | Photo picked, disclosure | A ground-level photo (eval scene e01, CC BY-SA 4.0, Famartin). The page says where the photo goes before upload. |
| 4 | Analyze → result | The wait is cut. The caption states the wait measured in the browser. Provenance shows LOCAL · LIVE MODEL CALL. |
| 5 | Plan marking | I mark the patches I was going to rake. |
| 6 | Receipt | What to reconsider, what to inspect, access work to keep. |
| 7 | Inspector → correction | One label corrected; the plan updates without another model call; the model's label is kept. |
| 8 | Updated receipt | Counts are grid cells, not area or time. |

Rules for any recording:
- Recorded example = "RECORDED REPLAY". Never present it as a live call.
- A cut wait must be captioned with its measured duration.
- Hosted runs are never described as offline. The offline claim applies only to the run in `eval/results/offline-run/`.
- If a run abstains (everything in review), show it. Do not re-roll until it looks good.
- The older `docs/rakeless-demo.mp4` shows a hosted Gemini API run of an earlier version on a transformed copy of the bundled scene; it is kept for history, not as evidence for this version.
