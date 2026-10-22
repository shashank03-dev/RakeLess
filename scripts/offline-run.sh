#!/bin/sh
# Runs Ollama, the RakeLess server and a headless browser inside a new network namespace that has
# ONLY a loopback interface, then records the local demo there. Linux only; needs `unshare` (util-linux).
#   OLLAMA_BIN=ollama OLLAMA_MODELS=~/.ollama/models sh scripts/offline-run.sh
# Evidence goes to eval/results/offline-run/. Requires a prior `npm run build` and a pulled model.
set -eu
OUT=${OUT:-eval/results/offline-run}
mkdir -p "$OUT" demo-out/local
exec unshare -rn sh -eu -c '
  OUT='"$OUT"'
  python3 -I scripts/netns-lo-up.py
  unset HTTPS_PROXY HTTP_PROXY https_proxy http_proxy ALL_PROXY
  {
    echo "date_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    python3 -I -c "
import socket
print(\"interfaces in this namespace:\", [n for _, n in socket.if_nameindex()])
for host,port in ((\"1.1.1.1\",443),(\"8.8.8.8\",53),(\"142.250.0.0\",443)):
    try:
        socket.create_connection((host,port),timeout=3); print(\"external\",host,\"REACHABLE\")
    except OSError as e: print(\"external\",host,\"blocked:\",e)
try:
    socket.getaddrinfo(\"generativelanguage.googleapis.com\",443); print(\"dns REACHABLE\")
except OSError as e: print(\"dns blocked:\",e)
"
  } > "$OUT/network-probe.txt" 2>&1
  OLLAMA_HOST=127.0.0.1:11434 ${OLLAMA_BIN:-ollama} serve > "$OUT/ollama.log" 2>&1 &
  # Cache off, so the API check and the demo each make a fresh model call.
  OBSERVATION_CACHE_TTL_MS=0 RAKELESS_PROVIDER=ollama OLLAMA_MODEL=${OLLAMA_MODEL:-gemma4:e4b} NODE_ENV=production PORT=8787 npx tsx server/dev.ts > "$OUT/server.log" 2>&1 &
  until curl -sf http://127.0.0.1:8787/api/health > /dev/null && curl -sf http://127.0.0.1:11434/api/version > /dev/null; do sleep 1; done
  curl -s http://127.0.0.1:8787/api/health > "$OUT/health-before.json"
  # Load the weights before the demo so the recorded wait is inference, not a cold load (load time is logged by Ollama).
  curl -s http://127.0.0.1:11434/api/generate -d "{\"model\":\"${OLLAMA_MODEL:-gemma4:e4b}\",\"keep_alive\":\"30m\"}" > "$OUT/warmup.json"
  # 1) The whole server path over HTTP, no browser competing for CPU.
  PHOTO=${PHOTO:-eval/images/e01-nj-lawn-sidewalk.jpg}
  T0=$(date +%s%3N)
  curl -s -H "Origin: http://127.0.0.1:8787" -F "image=@$PHOTO;type=image/jpeg" \
    -F "context={\"region\":\"temperate_na\",\"season\":\"autumn\",\"concerns\":\"none\"}" \
    http://127.0.0.1:8787/api/analyze > /tmp/rakeless-offline-response.json
  T1=$(date +%s%3N)
  PHOTO="$PHOTO" WALL=$((T1-T0)) node scripts/offline-summarize.cjs /tmp/rakeless-offline-response.json > "$OUT/analyze-response.json"
  # 2) Optional: the captioned browser demo (Chromium + video encoding compete with CPU inference).
  if [ "${DEMO:-0}" = 1 ]; then
    OUT=demo-out/local node scripts/record-demo-local.cjs > "$OUT/demo-run.json" 2> "$OUT/demo-run.err" || { cat "$OUT/demo-run.err"; exit 1; }
    cp demo-out/local/export.json "$OUT/export.json"
  fi
  curl -s http://127.0.0.1:8787/api/health > "$OUT/health-after.json"
  grep "api/chat" "$OUT/ollama.log" > "$OUT/ollama-chat-requests.txt" || true
  kill $(jobs -p) 2>/dev/null || true
'
