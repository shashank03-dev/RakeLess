#!/bin/sh
# Cuts the model wait out of the recorded local demo (keeps 1.5 s on each side) and encodes MP4.
# Usage: OUT=demo-out/local sh scripts/cut-demo.sh  → $OUT/rakeless-local-demo.mp4
set -eu
OUT=${OUT:-demo-out/local}
eval "$(node -e "const s=require('./$OUT/segments.json');console.log('V='+JSON.stringify(s.video)+' A='+(s.waitStart+1.5)+' B='+(s.waitEnd-1.5))")"
ffmpeg -y -loglevel error -i "$V" -filter_complex \
  "[0:v]trim=0:$A,setpts=PTS-STARTPTS[a];[0:v]trim=start=$B,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -movflags +faststart "$OUT/rakeless-local-demo.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/rakeless-local-demo.mp4"
