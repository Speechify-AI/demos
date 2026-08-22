import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

type Args = {
  text?: string;
  file?: string;
  voice: string;
  model: string;
  format: string;
  output?: string;
};

const VOICES_HINT =
  "george, henry, lily, matilda, simba-english, and any voice_id from platform.speechify.ai";

function parseArgs(argv: string[]): Args {
  const out: Args = { voice: "george", model: "simba-english", format: "mp3" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--text":
      case "-t":
        out.text = next();
        break;
      case "--file":
      case "-f":
        out.file = next();
        break;
      case "--voice":
      case "-v":
        out.voice = next();
        break;
      case "--model":
      case "-m":
        out.model = next();
        break;
      case "--format":
        out.format = next();
        break;
      case "--output":
      case "-o":
        out.output = next();
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${a}\nRun with --help for usage.`);
    }
  }
  return out;
}

function printHelp() {
  console.log(`speechify-tts — text-to-speech from your terminal

Usage:
  speechify-tts --text "Hello world" -o hello.mp3
  echo "Read this aloud" | speechify-tts -o out.mp3
  speechify-tts --file chapter.txt -v lily -m simba-english

Options:
  -t, --text <string>    Text to synthesize (ignored if --file given)
  -f, --file <path>      Read input text from a file
      --voice <id>       Voice id (default: george)
      --model <id>       Model id (default: simba-english)
      --format <fmt>     Output format: mp3, ogg, wav, etc. (default: mp3)
  -o, --output <path>    Write the audio file (default: stdout, raw bytes)
  -h, --help             Show this help

Voices include: ${VOICES_HINT}
Requires SPEECHIFY_API_KEY in the environment (copy .env.example to .env).`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file && !args.text && !process.stdin.isTTY) {
    args.text = await readStdin();
  }
  if (!args.file && !args.text) {
    printHelp();
    process.exit(1);
  }

  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) {
    throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  }

  const input = args.file
    ? fs.readFileSync(path.resolve(args.file), "utf8")
    : (args.text as string);

  const client = new SpeechifyClient({ token });

  try {
    const response = await client.audio.speech({
      input,
      voice_id: args.voice,
      audio_format: args.format as "mp3" | "ogg" | "wav" | "aac" | "pcm",
      model: args.model as
        | "simba-english"
        | "simba-multilingual"
        | "simba-3.0"
        | "simba-3.2",
    });

    const audio = Buffer.from(response.audio_data, "base64");

    if (args.output) {
      fs.writeFileSync(path.resolve(args.output), audio);
      console.error(
        `Wrote ${args.output} (${audio.length.toLocaleString()} bytes, ` +
          `${response.billable_characters_count} billable characters).`,
      );
    } else {
      process.stdout.write(audio);
    }
  } catch (err) {
    if (err instanceof SpeechifyError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
