"""Audiobook pipeline: chunk text on sentence boundaries, synthesize each chunk
via the Speechify Python SDK, write per-chunk MP3s ready for ffmpeg concat.

Run: `python main.py samples/chapter-01.txt`
Output: `output/<chapter-name>/part-NNN.mp3` for each chunk.
"""

from __future__ import annotations

import base64
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from speechify import Speechify

MAX_CHARS = 20_000


def chunk_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    """Split into chunks under max_chars, preferring paragraph then sentence boundaries.

    Branches, in order:
      1. Paragraph fits in current buffer. Append.
      2. Paragraph doesn't fit, but is under max_chars on its own. Flush, restart.
      3. Paragraph is larger than max_chars. Fall back to sentence splits.

    The sentence-split regex uses a lookbehind so the punctuation stays with the
    previous sentence. Splitting on a bare `.` breaks on abbreviations.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""

    for para in paragraphs:
        if len(buf) + len(para) + 2 <= max_chars:
            buf = f"{buf}\n\n{para}" if buf else para
            continue

        if buf:
            chunks.append(buf)
            buf = ""

        if len(para) > max_chars:
            for sent in re.split(r"(?<=[.!?])\s+", para):
                if len(buf) + len(sent) + 1 <= max_chars:
                    buf = f"{buf} {sent}".strip()
                else:
                    if buf:
                        chunks.append(buf)
                    buf = sent
        else:
            buf = para

    if buf:
        chunks.append(buf)
    return chunks


def synthesize_chunks(
    chunks: list[str],
    out_dir: Path,
    voice_id: str = "george",
    model: str = "simba-english",
    max_retries: int = 3,
) -> list[Path]:
    """Synthesize each chunk sequentially with exponential-backoff retries."""
    load_dotenv()
    token = os.environ.get("SPEECHIFY_API_KEY")
    if not token:
        raise SystemExit("Set SPEECHIFY_API_KEY (copy .env.example to .env).")

    client = Speechify(token=token)
    out_dir.mkdir(parents=True, exist_ok=True)

    files: list[Path] = []
    for i, chunk in enumerate(chunks):
        attempt = 0
        while True:
            try:
                resp = client.audio.speech(
                    input=chunk,
                    voice_id=voice_id,
                    audio_format="mp3",
                    model=model,
                )
                break
            except Exception as exc:
                attempt += 1
                if attempt > max_retries:
                    raise
                wait = 2**attempt
                print(f"chunk {i}: retry {attempt} after {wait}s ({exc})")
                time.sleep(wait)

        out = out_dir / f"part-{i:03d}.mp3"
        out.write_bytes(base64.b64decode(resp.audio_data))
        files.append(out)
        print(f"  wrote {out} ({out.stat().st_size:,} bytes)")

    return files


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <path-to-chapter.txt>")
        sys.exit(1)

    source = Path(sys.argv[1])
    if not source.exists():
        raise SystemExit(f"Not found: {source}")

    text = source.read_text()
    chunks = chunk_text(text)
    print(f"Source: {source} ({len(text):,} chars)")
    print(f"Chunks: {len(chunks)} (under {MAX_CHARS:,} char cap)")
    for i, c in enumerate(chunks):
        print(f"  chunk {i:>3}: {len(c):>6,} chars")

    chapter_name = source.stem
    out_dir = Path("output") / chapter_name
    files = synthesize_chunks(chunks, out_dir)

    print(f"\nWrote {len(files)} chunk MP3s to {out_dir}/")
    print(f"Stitch into one file with: ./concat.sh {out_dir}")


if __name__ == "__main__":
    main()
