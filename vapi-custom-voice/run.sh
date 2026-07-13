#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SHIM_DIR="$ROOT_DIR/.shim/tts-shims"
OUT_PCM="$ROOT_DIR/shim-smoke.pcm"
OUT_WAV="$ROOT_DIR/shim-smoke.wav"
SHIM_REF="${SHIM_REF:-d84f0f04eabd08e281a1541f8914c5293691a54f}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PORT="${SHIM_ADDR:-:8772}"
HOST_PORT="${PORT#:}"
VAPI_SECRET="${VAPI_SECRET:-local-smoke-secret}"
VAPI_SAMPLE_RATE="${VAPI_SAMPLE_RATE:-24000}"

if [[ -z "${SPEECHIFY_API_KEY:-}" || "$SPEECHIFY_API_KEY" == "sk_your_speechify_key_here" ]]; then
  printf 'set SPEECHIFY_API_KEY in %s or your shell environment\n' "$ENV_FILE" >&2
  exit 1
fi

for tool in go curl ffmpeg ffprobe python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '%s is required for this smoke test\n' "$tool" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$SHIM_DIR")"
if [[ ! -d "$SHIM_DIR/.git" ]]; then
  GIT_MASTER=1 git clone https://github.com/Speechify-AI/tts-shims "$SHIM_DIR"
fi
GIT_MASTER=1 git -C "$SHIM_DIR" fetch --depth 1 origin "$SHIM_REF"
GIT_MASTER=1 git -C "$SHIM_DIR" checkout --detach FETCH_HEAD

make -C "$SHIM_DIR" vapi

if [[ -z "${SSL_CERT_FILE:-}" && -f /etc/ssl/cert.pem ]]; then
  export SSL_CERT_FILE=/etc/ssl/cert.pem
fi

export SPEECHIFY_API_KEY
export SHIM_ADDR="$PORT"
export SHIM_DEFAULT_MODEL="${SHIM_DEFAULT_MODEL:-simba-3.2}"

"$SHIM_DIR/bin/vapi" > "$ROOT_DIR/.shim/vapi.log" 2>&1 &
SHIM_PID=$!
cleanup() {
  kill "$SHIM_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in 1 2 3 4 5; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${HOST_PORT}/healthz" || true)"
  if [[ "$code" == "200" ]]; then
    printf 'health 200\n'
    break
  fi
  sleep 1
done

if [[ "${code:-}" != "200" ]]; then
  printf 'shim did not become healthy. log follows:\n' >&2
  python3 - <<'PY' "$ROOT_DIR/.shim/vapi.log" "$SPEECHIFY_API_KEY" >&2
import sys
path, key = sys.argv[1:]
print(open(path).read().replace(key, "[REDACTED]"))
PY
  exit 1
fi

body="$(python3 - <<'PY' "$VAPI_SAMPLE_RATE"
import json, sys, time
sample_rate = int(sys.argv[1])
print(json.dumps({
    "message": {
        "type": "voice-request",
        "text": "Vapi custom voice, now speaking with Speechify.",
        "sampleRate": sample_rate,
        "timestamp": int(time.time() * 1000),
        "call": {},
        "assistant": {},
    }
}))
PY
)"

result="$(curl -s -o "$OUT_PCM" -w '%{http_code} %{size_download} %{content_type}' \
  -X POST "http://localhost:${HOST_PORT}/synthesize" \
  -H 'Content-Type: application/json' \
  -H "X-VAPI-SECRET: ${VAPI_SECRET}" \
  -d "$body")"

http_status="${result%% *}"
rest="${result#* }"
bytes="${rest%% *}"
content_type="${rest#* }"
printf 'synthesize %s %s bytes %s\n' "$http_status" "$bytes" "$content_type"

if [[ "$http_status" != "200" || "$content_type" != "application/octet-stream" || "$bytes" -lt 1000 ]]; then
  printf 'expected raw PCM bytes, got:\n' >&2
  python3 - <<'PY' "$OUT_PCM" >&2
import sys
print(open(sys.argv[1], "rb").read(4096))
PY
  exit 1
fi

ffmpeg -v error -f s16le -ar "$VAPI_SAMPLE_RATE" -ac 1 -i "$OUT_PCM" "$OUT_WAV" -y
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT_WAV"
python3 - <<'PY' "$OUT_PCM"
import struct
import sys

raw = open(sys.argv[1], "rb").read()
samples = struct.unpack("<" + "h" * (len(raw) // 2), raw[: len(raw) // 2 * 2])
nonzero = sum(1 for sample in samples if sample)
peak = max((abs(sample) for sample in samples), default=0)
print(f"samples={len(samples)} nonzero={nonzero} peak={peak}")
if nonzero == 0 or peak == 0:
    raise SystemExit(1)
PY

printf 'raw PCM saved to %s\n' "$OUT_PCM"
printf 'WAV proof saved to %s\n' "$OUT_WAV"
