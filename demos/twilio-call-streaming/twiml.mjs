// The TwiML a real call needs: connect an inbound call to the Media Streams
// WebSocket. Pure string building — fully testable.

export function twiml(host) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/stream" />
  </Connect>
</Response>`;
}
