# Automated audiobook pipeline

Splits long-form text on sentence boundaries, synthesizes each chunk via the [Speechify Python SDK](https://github.com/SpeechifyInc/speechify-api-sdk-python), and concatenates the resulting MP3s with `ffmpeg` into a single chapter file.

## What you get

- `main.py` — the full split-loop-stitch pipeline (chunker + synthesis loop with retries)
- `concat.sh` — `ffmpeg -f concat` invocation to stitch chunk MP3s into one file
- `samples/chapter-01.txt` — short demo chapter (~420 chars, one chunk under the cap)
- `output/chapter-01/` — sample synthesized output (committed for reference)

## Run it

```bash
cp .env.example .env             # paste your SPEECHIFY_API_KEY
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python main.py samples/chapter-01.txt
./concat.sh output/chapter-01    # produces output/chapter-01/chapter-01.mp3
```

Equivalent with stock `pip`:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py samples/chapter-01.txt
./concat.sh output/chapter-01
```

## What the chunker is doing

Long-form TTS breaks at the per-request character ceiling (20,000 characters on Speechify). Naive character splits cut mid-word and the audio "exhales" weirdly at chunk boundaries. This chunker uses three branches in order of preference:

1. Paragraph fits in the current buffer alongside whatever's already there. Append.
2. Paragraph doesn't fit, but is itself under the cap. Flush the buffer, start a new chunk.
3. Paragraph is larger than the cap. Fall back to sentence-boundary splits via `(?<=[.!?])\s+` (split AFTER sentence punctuation on whitespace only, lookbehind so the punctuation stays with the previous sentence).

The sentence-split regex matters. Splitting on a bare `.` breaks on every abbreviation (Mr. Smith becomes "Mr" and "Smith"). The lookbehind keeps the punctuation attached.

## The ffmpeg concat command

```bash
ffmpeg -f concat -safe 0 -i manifest.txt -c copy chapter-01.mp3
```

- `-f concat` uses the concat demuxer, which expects a manifest of input files.
- `-safe 0` allows absolute paths in the manifest (security default rejects them).
- `-c copy` re-muxes without re-encoding, preserving audio quality bit-for-bit and finishing in seconds.

`concat.sh` builds the manifest from `output/<chapter>/part-*.mp3` automatically.

## Prerequisites

- Python 3.10 or newer
- [`uv`](https://docs.astral.sh/uv/) (recommended) or `pip`
- `ffmpeg` for the concat step (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Debian/Ubuntu)
- A `SPEECHIFY_API_KEY` from [console.speechify.ai/api-keys](https://console.speechify.ai/api-keys)
