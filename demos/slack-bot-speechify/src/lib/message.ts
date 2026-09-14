// Pure message-handling rules for the Slack bot: which events get read aloud
// and what gets posted. No I/O, no Slack SDK, no API — fully unit-testable.

export interface SlackMessageEvent {
  type?: string;
  subtype?: string;
  bot_id?: string;
  channel?: string;
  text?: string;
}

// A message is worth reading aloud when it is a real user message: the right
// event type, no subtype (edits, joins, thread broadcasts are skipped), not
// from a bot (including our own posts), in a channel, with non-empty text.
export function shouldReadAloud(event: SlackMessageEvent): boolean {
  if (event.type !== "message") return false;
  if (event.subtype) return false;
  if (event.bot_id) return false;
  if (!event.channel) return false;
  return (event.text ?? "").trim().length > 0;
}

// The upload filename is fixed; the title carries a preview of the message.
export const UPLOAD_FILENAME = "read-aloud.mp3";
export const TITLE_MAX_CHARS = 80;

export function uploadTitle(text: string): string {
  return `Read aloud: ${text.trim().slice(0, TITLE_MAX_CHARS)}`;
}

// The error message posted back to the channel when synthesis fails.
export function failureMessage(text: string, error: string): string {
  return `I couldn't read that aloud: ${error}`;
}
