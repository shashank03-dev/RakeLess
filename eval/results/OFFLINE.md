# Offline (loopback-only) runs

`scripts/offline-run.sh` starts Ollama, the RakeLess server, and optionally a headless browser inside a new
Linux network namespace (`unshare -rn`) whose only interface is `lo`. Before anything runs it probes
external addresses and DNS and writes the result to `network-probe.txt`.

## Successful run: `offline-run/` (2026-10-22 19:08–19:11 UTC)

- `network-probe.txt`: interfaces `['lo']`; 1.1.1.1, 8.8.8.8 and a Google address unreachable; DNS fails.
- `health-before.json`: provider `ollama`, `local: true`, model `gemma4:e4b`, digest `sha256:dc35e8d9…`, status `ready`.
- `analyze-response.json`: `POST /api/analyze` with `eval/images/e01-nj-lawn-sidewalk.jpg` (made with curl, no browser).
  `mode: live`, `cacheHit: false` (the cache was disabled for this run), `attempts: 1`, model time 111.3 s, server time
  112.6 s, curl wall time 112.6 s. The image data URL is omitted from the saved file.
- `ollama-chat-requests.txt`: exactly one `/api/chat` request, status 200, 1 m 51 s, from 127.0.0.1.
- `ollama.log` also shows Ollama itself trying to reach `ollama.com` for "model recommendations" and failing, which
  is further confirmation that external network access was blocked.

The labels are identical to the evaluation run on the same photo (temperature 0), including its main error:
the three tree-canopy cells are reported as "lawn, fallen leaves".

## Failed attempts (kept as evidence)

| Folder | What happened |
|---|---|
| `offline-run-attempt1-timeout/` | Browser demo + cold model load. The request hit the then 280 s local attempt cap; the server returned a clean `504` after 281 s. Local defaults were raised to 600 s. |
| `offline-run-attempt2-cpu-contention/` | Browser recording video while the model ran. Prompt processing fell to about 2.4 tokens/s (about 25 during the evaluation), Ollama's runner returned `500` after about 5 minutes, and the server retried once (counted: `attempts: 2`) before the 600 s deadline returned `504`. |
| `offline-run-attempt4-demo-cpu-contention/` | Step 1 (curl, no browser) **succeeded again**: live, uncached, 1 attempt, model 110.4 s, wall 111.7 s (`analyze-response.json`). Step 2, the captioned browser demo with canvases hidden at 1280×720, failed like attempt 2. |
| `offline-run-attempt3-cpu-contention/` | The same after a VM restart (cold disk cache): the warm-up load itself failed after 5.5 minutes, then both attempts failed as above. |

So **no captioned local demo video exists**. On a 4-core CPU, Chromium's video capture and the page's canvas animations compete with inference.
Both successful runs made the request without a browser. To record the video, use a machine with more cores or a GPU: `DEMO=1 sh scripts/offline-run.sh`, then `sh scripts/cut-demo.sh`.
