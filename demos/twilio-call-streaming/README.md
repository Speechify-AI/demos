# twilio-call-streaming

Stream a Speechify voice straight into a live Twilio phone call, in real time, over Twilio Media Streams.

Pairs with the speechify.ai post **"Stream Speechify audio into a live phone call with Twilio."**

This is a **standalone clone-and-run** demo (a persistent WebSocket server), not a hostable Vercel service. Twilio is **stubbed** so you can run and test the whole thing with no Twilio account, phone number, or tunnel. The Speechify side is real.

## Why there's no transcoding

Twilio Media Streams carries audio as base64 **8 kHz mu-law** in 20 ms (160-byte) frames. Speechify emits exactly that when you request `output_format: "ulaw_8000"` on `POST /v1/audio/stream` (the spec calls `pcm_16000` and `ulaw_8000` "the telephony formats Twilio/LiveKit SIP expect"). So the server reads the mu-law stream, cuts it into 160-byte frames, and forwards each as a Twilio `media` message. No decode, no resample, no library.

## Run it locally (Twilio stubbed)

```bash
cp .env.example .env      # add your SPEECHIFY_API_KEY
npm install
npm run e2e               # boots the server, runs the stub Twilio client, asserts audio flowed
```

`npm run e2e` starts `server.mjs`, then runs `stub-twilio.mjs`, which speaks Twilio's Media Streams protocol (`connected`, `start`), collects the `media` frames the server streams back, writes them to `out.ul`, and exits non-zero if no audio arrived.

Listen to what the call would have heard:

```bash
ffplay -f mulaw -ar 8000 out.ul
```

To run the pieces separately: `npm start` (server), then `npm run stub` in another shell.

## Wire it to a real call

1. Expose the server publicly (e.g. `ngrok http 8790`).
2. Point a Twilio number's Voice webhook at `https://<public-host>/twiml`. It returns:
   ```xml
   <Response>
     <Connect>
       <Stream url="wss://<public-host>/stream" />
     </Connect>
   </Response>
   ```
3. Call the number. Twilio opens the `/stream` WebSocket, the server synthesizes with Speechify, and the caller hears it.

## How it works

- `server.mjs` — HTTP (`/twiml`, `/health`) plus a WebSocket at `/stream`. On the Twilio `start` event it calls Speechify `POST /v1/audio/stream` with `ulaw_8000`, frames the stream, and sends `media` messages, then a `mark`.
- `stub-twilio.mjs` — the fake Twilio peer used for local runs and the e2e check.
- The Speechify API key stays server-side.

## Notes

- The server synthesizes a fixed greeting (`TEXT` env) on call start. A real app would drive the text from its own logic (an LLM turn, a script, an IVR branch).
- This handles TTS out. Handling caller audio in (`media` events inbound) for speech-to-text is left out to keep the demo focused.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPEECHIFY_API_KEY` | yes | Server-side Speechify API key |
| `PORT` | no | Server port (default 8790) |
| `VOICE_ID` / `MODEL` / `TEXT` | no | Override the voice, model, or spoken text |
