// Pure slash-command handling for the Discord bot: which interactions to
// answer and what gets posted. No I/O, no Discord SDK, no API — fully
// unit-testable.

export const SPEAK_COMMAND = "speak";
export const REPLY_NO_TEXT = "Give me some text to speak.";
export const PREVIEW_MAX_CHARS = 120;
export const UPLOAD_FILENAME = "speak.mp3";

// Pulls the /speak <text> option out of an interaction. Returns "" when the
// interaction is not a chat-input command or not our command.
export function speakTextFrom(interaction: {
  isChatInputCommand(): boolean;
  commandName?: string;
  options?: { getString(name: string, required: boolean): string | null };
}): string | null {
  if (!interaction.isChatInputCommand()) return null;
  if (interaction.commandName !== SPEAK_COMMAND) return null;
  const text = interaction.options?.getString("text", true);
  return text ? text.trim() : "";
}

// The Discord attachment preview line. Keep it short — the spoken audio is
// the point, the caption is a label.
export function previewLine(text: string): string {
  return `🎙 ${text.trim().slice(0, PREVIEW_MAX_CHARS)}`;
}

// The error message posted back into the channel when synthesis fails.
export function failureMessage(error: string): string {
  return `I couldn't speak that: ${error}`;
}
