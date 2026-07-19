#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SHIM_DIR="$ROOT_DIR/.shim/tts-shims"
OUT_FILE="$ROOT_DIR/shim-smoke.mp3"
SHIM_REF="${SHIM_REF:-fe7c3df74789da325d9c49c5576e212004986ef8}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PORT="${SHIM_ADDR:-:8771}"
HOST_PORT="${PORT#:}"

if [[ -z "${SPEECHIFY_API_KEY:-}" || "$SPEECHIFY_API_KEY" == "sk_your_speechify_key_here" ]]; then
  printf 'set SPEECHIFY_API_KEY in %s\n' "$ENV_FILE" >&2
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  printf 'go is required to build the shim. install Go or build the tts-shims Docker image instead.\n' >&2
  exit 1
fi

mkdir -p "$(dirname "$SHIM_DIR")"
if [[ ! -d "$SHIM_DIR/.git" ]]; then
  git clone https://github.com/Speechify-AI/tts-shims "$SHIM_DIR"
fi
git -C "$SHIM_DIR" fetch --depth 1 origin "$SHIM_REF"
git -C "$SHIM_DIR" checkout --detach FETCH_HEAD

make -C "$SHIM_DIR" openai

if [[ -z "${SSL_CERT_FILE:-}" && -f /etc/ssl/cert.pem ]]; then
  export SSL_CERT_FILE=/etc/ssl/cert.pem
fi

export SPEECHIFY_API_KEY
export SHIM_ADDR="$PORT"

"$SHIM_DIR/bin/openai" > "$ROOT_DIR/.shim/openai.log" 2>&1 &
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
  sed "s/${SPEECHIFY_API_KEY}/[REDACTED]/g" "$ROOT_DIR/.shim/openai.log" >&2
  exit 1
fi

result="$(curl -s -o "$OUT_FILE" -w '%{http_code} %{size_download}' \
  -X POST "http://localhost:${HOST_PORT}/v1/audio/speech" \
  -H 'Authorization: Bearer placeholder-ignored-by-shim' \
  -H 'Content-Type: application/json' \
  -d '{"model":"simba-3.2","input":"Deepgram voice agent, now speaking with Speechify.","voice":"geffen_32","response_format":"mp3"}')"

status="${result%% *}"
bytes="${result##* }"
printf 'speak %s %s bytes\n' "$status" "$bytes"

if [[ "$status" != "200" || "$bytes" -lt 1000 ]]; then
  printf 'expected audio bytes, got:\n' >&2
  cat "$OUT_FILE" >&2
  exit 1
fi

printf 'audio saved to %s\n' "$OUT_FILE"
