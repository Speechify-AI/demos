const { writeFile } = require("fs/promises");
const { DeepgramClient } = require("@deepgram/sdk");
const fetch = require("cross-fetch");
const { join } = require("path");

const SHIM_URL = process.env.SHIM_URL;
if (!SHIM_URL) {
  throw new Error("set SHIM_URL to a public https url that reaches your running shim (e.g. an ngrok tunnel)");
}
if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error("set DEEPGRAM_API_KEY");
}

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

const agent = async () => {
  let audioBuffer = Buffer.alloc(0);
  let i = 0;
  const url = "https://dpgr.am/spacewalk.wav";
  const connection = await deepgram.agent.v1.connect();

  const done = new Promise((resolve) => {
    connection.on("message", async (data) => {
      if (data.type === "Welcome") {
        connection.sendSettings({
          type: "Settings",
          audio: {
            input: { encoding: "linear16", sample_rate: 24000 },
            // The open_ai speak provider requires uncontainerized 24kHz linear16 output.
            output: { encoding: "linear16", sample_rate: 24000 },
          },
          agent: {
            language: "en",
            listen: { provider: { type: "deepgram", model: "nova-3" } },
            think: {
              provider: { type: "open_ai", model: "gpt-4o-mini" },
              prompt: "You are a friendly assistant. Answer in one short sentence.",
            },
            speak: {
              // The shim passes non-OpenAI names straight through to Speechify,
              // so send a real Speechify model + voice for the best quality.
              provider: { type: "open_ai", model: "simba-3.2", voice: "geffen_32" },
              endpoint: {
                url: `${SHIM_URL}/v1/audio/speech`,
                headers: {
                  authorization: "Bearer placeholder-ignored-by-shim",
                  "ngrok-skip-browser-warning": "1",
                },
              },
            },
            greeting: "Hello! How can I help you today?",
          },
        });
        console.log(`settings sent, speak endpoint -> ${SHIM_URL}/v1/audio/speech`);

        const keepAlive = setInterval(() => connection.sendKeepAlive({ type: "KeepAlive" }), 5000);
        connection.on("close", () => clearInterval(keepAlive));

        fetch(url)
          .then((r) => r.body)
          .then((res) => {
            res.on("readable", () => {
              const chunk = res.read();
              if (chunk) connection.sendMedia(chunk);
            });
          });
      } else if (data.type === "SettingsApplied") {
        console.log("settings applied");
      } else if (data.type === "ConversationText") {
        console.log(`${data.role}: ${data.content}`);
      } else if (typeof Blob !== "undefined" && data instanceof Blob) {
        audioBuffer = Buffer.concat([audioBuffer, Buffer.from(await data.arrayBuffer())]);
      } else if (data.type === "AgentAudioDone") {
        if (audioBuffer.length) {
          await writeFile(join(__dirname, `agent-output-${i}.wav`), audioBuffer);
          console.log(`agent spoke ${audioBuffer.length} bytes via the shim -> agent-output-${i}.wav`);
          i++;
        }
        audioBuffer = Buffer.alloc(0);
        resolve();
      } else if (data.type === "Error" || data.type === "Warning") {
        console.log(`${data.type}: ${JSON.stringify(data)}`);
      }
    });
  });

  connection.on("error", (err) => console.error("error:", err.message));
  connection.connect();
  await connection.waitForOpen();
  await Promise.race([done, new Promise((r) => setTimeout(r, 45000))]);
  process.exit(0);
};

void agent();
