#!/usr/bin/env bash
# Concatenate the per-chunk MP3s from output/<dir> into one file.
# Usage: ./concat.sh output/<dir> [output.mp3]
set -euo pipefail

src="${1:?usage: ./concat.sh <output-dir> [output.mp3]}"
out="${2:-daily-digest.mp3}"
list="$(mktemp -t rss-audio-digest.XXXXXX)"
trap 'rm -f "$list"' EXIT

for f in "$src"/part-*.mp3; do
  printf "file '%s'\n" "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" >>"$list"
done

ffmpeg -y -f concat -safe 0 -i "$list" -c copy "$out"
echo "Wrote $out ($(du -h "$out" | cut -f1))"