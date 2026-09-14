import { describe, it, expect } from "vitest";
import {
  speakTextFrom,
  previewLine,
  failureMessage,
  REPLY_NO_TEXT,
  PREVIEW_MAX_CHARS,
  UPLOAD_FILENAME,
} from "../src/lib/interaction.ts";

// Pure interaction rules: the bot answers only its own /speak command and
// keeps every posted line short and stable.

function chatInput(commandName: string, text: string) {
  return {
    isChatInputCommand: () => true,
    commandName,
    options: { getString: () => text },
  };
}

describe("speakTextFrom", () => {
  it("returns trimmed text for the /speak command", () => {
    expect(speakTextFrom(chatInput("speak", "  hello there  "))).toBe("hello there");
  });

  it("ignores other chat-input commands", () => {
    expect(speakTextFrom(chatInput("ping", "hello"))).toBeNull();
  });

  it("ignores non-chat-input interactions", () => {
    const interaction = {
      isChatInputCommand: () => false,
      commandName: "speak",
      options: { getString: () => "hello" },
    };
    expect(speakTextFrom(interaction)).toBeNull();
  });

  it("returns an empty string when no text was given", () => {
    expect(speakTextFrom(chatInput("speak", ""))).toBe("");
  });
});

describe("previewLine", () => {
  it("previews the spoken text", () => {
    expect(previewLine("hello")).toBe("🎙 hello");
  });

  it("caps the preview length", () => {
    const long = previewLine("x".repeat(500));
    expect(long.length).toBeLessThanOrEqual("🎙 ".length + PREVIEW_MAX_CHARS);
  });
});

describe("failureMessage", () => {
  it("tells the user why synthesis failed", () => {
    expect(failureMessage("bad key")).toBe("I couldn't speak that: bad key");
  });
});

describe("constants", () => {
  it("keeps the no-text reply and upload filename stable", () => {
    expect(REPLY_NO_TEXT).toBe("Give me some text to speak.");
    expect(UPLOAD_FILENAME).toBe("speak.mp3");
  });
});
