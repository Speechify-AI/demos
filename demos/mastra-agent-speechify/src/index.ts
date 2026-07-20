import { Agent } from '@mastra/core/agent';
import { SpeechifyVoice } from '@mastra/voice-speechify';
import { openai } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import path from 'node:path';

config();

if (!process.env.SPEECHIFY_API_KEY) {
  throw new Error('SPEECHIFY_API_KEY not set. Copy .env.example to .env.');
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY not set. Copy .env.example to .env.');
}

// Curated Simba 3 voices exported as SIMBA_3_VOICES: beatrice_32, dominic_32,
// edmund_32, geffen_32, harper_32, hugh_32, imogen_32, wyatt_32.
const voice = new SpeechifyVoice({
  speechModel: { name: 'simba-3.2' },
  speaker: 'harper_32',
});

const agent = new Agent({
  id: 'speechify-voice-agent',
  name: 'Voice Assistant',
  instructions:
    'You are a helpful voice assistant powered by Speechify text-to-speech. ' +
    'Keep replies short and conversational — one or two sentences.',
  model: openai('gpt-4o-mini'),
});

const outDir = path.resolve('./out');

async function synth(text: string, filename: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const stream = await voice.speak(text);
  const filepath = path.join(outDir, filename);
  await pipeline(stream, createWriteStream(filepath));
  return filepath;
}

async function play(filepath: string): Promise<void> {
  // Try common CLI audio players in order. First one that succeeds wins.
  const candidates: Array<[string, string[]]> =
    platform() === 'darwin'
      ? [['afplay', [filepath]]]
      : [
          ['mpg123', ['-q', filepath]],
          ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'error', filepath]],
          ['play', ['-q', filepath]],
        ];

  for (const [bin, args] of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(bin, args, { stdio: 'ignore' });
        proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} exit ${code}`))));
        proc.on('error', reject);
      });
      return;
    } catch {
      // fall through to next candidate
    }
  }
  console.warn(`No supported audio player found. Play it yourself: ${filepath}`);
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log('Speechify + Mastra voice agent — simba-3.2 · harper_32');
  console.log('Type a message, or press Enter with no input to quit.\n');

  let turn = 0;
  while (true) {
    const userInput = (await rl.question('you › ')).trim();
    if (!userInput) break;

    try {
      const { text } = await agent.generate(userInput);
      console.log(`agent › ${text}`);

      const filepath = await synth(text, `turn-${String(++turn).padStart(3, '0')}.mp3`);
      await play(filepath);
      console.log(`  (saved ${path.relative(process.cwd(), filepath)})\n`);
    } catch (err) {
      console.error(`error: ${(err as Error).message}\n`);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
