import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

type SpeechParams = Parameters<SpeechifyClient["audio"]["speech"]>[0];

function usage(): string {
  return `Usage: tts [options] [text...]

  Turns text into spoken audio with the Speechify API and writes an audio file.

  Options:
    -t, --text <text>    Text to speak (or pass as trailing args / stdin)
    -v, --voice <id>     Voice ID (default: geffen_32)
    -m, --model <name>   Model (default: simba-3.2)
    -f, --format <fmt>   Audio format: mp3, ogg, wav, pcm, opus (default: mp3)
    -o, --out <path>     Output file (default: output/speech.mp3)
    -h, --help           Show this help

  Examples:
    tts "Hello from the terminal"
    echo "Read this aloud" | tts
    tts -v rivera_33 -o voice.mp3 "Status update"`;
}

interface Args {
  text?: string;
  voice: string;
  model: string;
  format: string;
  out: string;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    voice: "geffen_32",
    model: "simba-3.2",
    format: "mp3",
    out: "output/speech.mp3",
    help: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}\n${usage()}`);
      return v;
    };

    if (a === "-h" || a === "--help") {
      args.help = true;
    } else if (a === "-t" || a === "--text") {
      args.text = take();
    } else if (a === "-v" || a === "--voice") {
      args.voice = take();
    } else if (a === "-m" || a === "--model") {
      args.model = take();
    } else if (a === "-f" || a === "--format") {
      args.format = take();
    } else if (a === "-o" || a === "--out") {
      args.out = take();
    } else if (a.startsWith("--") && a.includes("=")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (k === "text") args.text = v;
      else if (k === "voice") args.voice = v;
      else if (k === "model") args.model = v;
      else if (k === "format") args.format = v;
      else if (k === "out") args.out = v;
      else if (k === "help") args.help = true;
      else throw new Error(`Unknown option: ${a}\n${usage()}`);
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}\n${usage()}`);
    } else {
      positional.push(a);
    }
  }

  if (!args.text && positional.length) args.text = positional.join(" ");
  return args;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) {
    throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  }

  if (!args.text) {
    const stdin = await readStdin();
    if (!stdin) {
      throw new Error(
        "No text provided. Pass text as an argument, -t, or pipe via stdin.\n" +
          usage(),
      );
    }
    args.text = stdin;
  }

  const client = new SpeechifyClient({ token });

  const response = await client.audio.speech({
    input: args.text,
    voice_id: args.voice,
    audio_format: args.format as SpeechParams["audio_format"],
    model: args.model as SpeechParams["model"],
  });

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(response.audio_data, "base64"));

  console.log(
    `Wrote ${args.out} (${response.billable_characters_count} billable characters, voice ${args.voice}, model ${args.model}).`,
  );
}

main().catch((err: unknown) => {
  if (err instanceof SpeechifyError) {
    console.error(`Speechify API error: ${err.message}`);
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
