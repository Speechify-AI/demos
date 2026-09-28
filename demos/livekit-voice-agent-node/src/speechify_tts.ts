import {
  type APIConnectOptions,
  APIConnectionError,
  APIError,
  APIStatusError,
  APITimeoutError,
  AudioByteStream,
  DEFAULT_API_CONNECT_OPTIONS,
  shortuuid,
  tts,
} from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import { readFileSync } from 'node:fs';

const STREAM_URL = 'https://api.speechify.ai/v1/audio/stream';
const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const DEMO_VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

export interface SpeechifyTTSOptions {
  voiceId: string;
  model: string;
  apiKey: string;
}

/**
 * LiveKit TTS over Speechify's streaming HTTP API: one POST per text, 24 kHz mono PCM
 * frames pushed as the response streams in. It is non-streaming in LiveKit's sense
 * (text in, audio out), so AgentSession feeds it one sentence at a time.
 */
export class SpeechifyTTS extends tts.TTS {
  label = 'speechify.TTS';
  #opts: SpeechifyTTSOptions;

  constructor({
    voiceId = 'dominic_32',
    model = 'simba-3.2',
    apiKey = process.env.SPEECHIFY_API_KEY,
  }: Partial<SpeechifyTTSOptions> = {}) {
    super(SAMPLE_RATE, NUM_CHANNELS, { streaming: false });
    if (!apiKey) throw new Error('Set SPEECHIFY_API_KEY or pass apiKey to SpeechifyTTS');
    this.#opts = { voiceId, model, apiKey };
  }

  get model(): string {
    return this.#opts.model;
  }

  get provider(): string {
    return 'Speechify';
  }

  synthesize(
    text: string,
    connOptions?: APIConnectOptions,
    abortSignal?: AbortSignal,
  ): tts.ChunkedStream {
    return new SpeechifyChunkedStream(this, text, this.#opts, connOptions, abortSignal);
  }

  stream(): tts.SynthesizeStream {
    throw new Error('SpeechifyTTS is non-streaming; wrap it in tts.StreamAdapter');
  }
}

class SpeechifyChunkedStream extends tts.ChunkedStream {
  label = 'speechify.ChunkedStream';
  #opts: SpeechifyTTSOptions;
  #timeoutMs: number;

  constructor(
    parent: SpeechifyTTS,
    text: string,
    opts: SpeechifyTTSOptions,
    connOptions: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    abortSignal?: AbortSignal,
  ) {
    super(text, parent, connOptions, abortSignal);
    this.#opts = opts;
    this.#timeoutMs = connOptions.timeoutMs;
  }

  protected async run(): Promise<void> {
    const requestId = shortuuid();
    const bytes = new AudioByteStream(SAMPLE_RATE, NUM_CHANNELS);
    // An idle timeout: it fires when no bytes arrive for timeoutMs, not when a long reply runs long.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.#timeoutMs);
    const signal = AbortSignal.any([this.abortSignal, timeout.signal]);

    let pending: AudioFrame | undefined;
    let sentAudio = false;
    // Holds one frame back so the last one can be marked final.
    const push = (frames: AudioFrame[]) => {
      for (const frame of frames) {
        if (pending) {
          this.queue.put({ requestId, segmentId: requestId, frame: pending, final: false });
          sentAudio = true;
        }
        pending = frame;
      }
    };

    try {
      const response = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#opts.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'audio/pcm',
          'Speechify-Caller': 'livekit',
          'Speechify-Caller-Version': DEMO_VERSION,
        },
        body: JSON.stringify({
          input: this.inputText,
          voice_id: this.#opts.voiceId,
          model: this.#opts.model,
          output_format: 'pcm_24000',
        }),
        signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new APIStatusError({
          message: `Speechify stream request failed with HTTP ${response.status}`,
          options: {
            statusCode: response.status,
            requestId: response.headers.get('speechify-request-id'),
          },
        });
      }
      if (!response.body) throw new APIConnectionError({ message: 'Speechify sent no audio' });

      for await (const chunk of response.body) {
        timer.refresh();
        push(bytes.write(chunk));
      }
      push(bytes.flush());
      if (pending) {
        this.queue.put({ requestId, segmentId: requestId, frame: pending, final: true });
      }
    } catch (error) {
      if (this.abortSignal.aborted) return;
      if (error instanceof APIError) throw error;
      // Retrying after audio went out would repeat the start of the sentence.
      const options = { retryable: !sentAudio };
      if (timeout.signal.aborted) {
        throw new APITimeoutError({ message: 'Speechify stream request timed out', options });
      }
      throw new APIConnectionError({ message: 'Speechify stream request failed', options });
    } finally {
      clearTimeout(timer);
    }
  }
}
