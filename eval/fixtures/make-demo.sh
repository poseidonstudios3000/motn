#!/usr/bin/env bash
# Generates a synthetic 45s vertical "talking head" stand-in for offline
# pipeline testing: animated backdrop + head-and-shoulders silhouette + tone.
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
ffmpeg -y \
  -f lavfi -i "gradients=size=1080x1920:speed=0.02:c0=0x1a2340:c1=0x0b0e14:duration=45:rate=30" \
  -f lavfi -i "sine=frequency=180:sample_rate=48000:duration=45" \
  -filter_complex "\
    [0:v]drawbox=x=340:y=520:w=400:h=400:color=0xd9b38c@1.0:t=fill,\
    drawbox=x=240:y=920:w=600:h=1000:color=0x27354f@1.0:t=fill,\
    drawtext=text='DEMO SPEAKER':fontcolor=white@0.85:fontsize=64:x=(w-text_w)/2:y=300[v]" \
  -map "[v]" -map 1:a -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -shortest "$dir/demo.mp4"
echo "wrote $dir/demo.mp4"
