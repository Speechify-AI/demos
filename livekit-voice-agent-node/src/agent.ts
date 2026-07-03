import { type JobContext, WorkerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import * as speechify from '@speechify/livekit-plugin';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // AgentSession uses the bundled Silero VAD by default.
    const session = new voice.AgentSession({
      stt: new deepgram.STT({ model: 'nova-3' }),
      llm: new openai.LLM({ model: 'gpt-4.1-mini' }),
      tts: new speechify.TTS({ voiceId: 'jack', model: 'simba-3.0' }),
    });

    await session.start({
      agent: new voice.Agent({
        instructions:
          'You are a helpful voice assistant speaking with a Speechify voice. ' +
          'Keep replies short and conversational.',
      }),
      room: ctx.room,
    });

    await ctx.connect();
    session.say("Hi! I'm powered by Speechify text to speech. How can I help?");
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
