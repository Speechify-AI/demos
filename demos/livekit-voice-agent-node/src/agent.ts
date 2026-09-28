import { type JobContext, ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { SpeechifyTTS } from './speechify_tts.js';

config();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // AgentSession uses the bundled Silero VAD by default, and feeds a non-streaming
    // TTS like SpeechifyTTS one sentence at a time.
    const session = new voice.AgentSession({
      stt: new deepgram.STT({ model: 'nova-3' }),
      llm: new openai.LLM({ model: 'gpt-4.1-mini' }),
      tts: new SpeechifyTTS({ voiceId: 'dominic_32', model: 'simba-3.2' }),
    });

    await session.start({
      agent: new voice.Agent({
        instructions:
          'You are a helpful voice assistant speaking with a Speechify voice. ' +
          'Keep replies short and conversational.',
      }),
      room: ctx.room,
    });

    session.say("Hi! I'm powered by Speechify text to speech. How can I help?");
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
