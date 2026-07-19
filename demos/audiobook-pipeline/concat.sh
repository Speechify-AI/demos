#!/usr/bin/env bash
# Concatenate part-NNN.mp3 files in a chapter directory into one chapter MP3.
# Lossless: re-muxes with `-c copy` (no re-encode).
#
# Usage: ./concat.sh output/chapter-01

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <chapter-dir>" >&2
  exit 1
fi

CHAPTER_DIR="$1"
if [ ! -d "$CHAPTER_DIR" ]; then
  echo "Not a directory: $CHAPTER_DIR" >&2
  exit 1
fi

CHAPTER_NAME=$(basename "$CHAPTER_DIR")
MANIFEST="$CHAPTER_DIR/manifest.txt"
OUTPUT="$CHAPTER_DIR/$CHAPTER_NAME.mp3"

# Build the manifest from every part-NNN.mp3 in sort order. The concat demuxer
# wants absolute paths and the `file '<path>'` syntax.
> "$MANIFEST"
for f in "$CHAPTER_DIR"/part-*.mp3; do
  if [ -f "$f" ]; then
    abs=$(cd "$(dirname "$f")" && pwd)/$(basename "$f")
    printf "file '%s'\n" "$abs" >> "$MANIFEST"
  fi
done

if [ ! -s "$MANIFEST" ]; then
  echo "No part-*.mp3 files found in $CHAPTER_DIR" >&2
  exit 1
fi

# -safe 0 allows absolute paths in the manifest (default rejects them for security).
# -c copy preserves the existing audio bitstream (no re-encode, no quality loss).
ffmpeg -y -f concat -safe 0 -i "$MANIFEST" -c copy "$OUTPUT" 2>&1 | tail -5

echo
echo "Wrote $OUTPUT"
ls -lh "$OUTPUT"
