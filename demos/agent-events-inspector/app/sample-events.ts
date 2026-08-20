// A sample realtime event stream for one voice-agent call, used by the inspector
// when you don't have a live conversation to point at. It is ILLUSTRATIVE — it
// shows the shape of events you'd consume from a live call and how the debug
// timeline renders them. Confirm the exact live event schema against the Voice
// Agents API docs (https://docs.speechify.ai) before depending on field names.

export type AgentEvent = {
  /** Milliseconds since the call started. */
  t: number;
  /** Event type, dotted namespace. */
  type: string;
  /** Free-form payload for that event type. */
  data?: Record<string, unknown>;
};

export type SampleConversation = {
  id: string;
  agent_id: string;
  status: "completed";
  started_at: string;
  ended_at: string;
  duration_ms: number;
  events: AgentEvent[];
};

export const SAMPLE: SampleConversation = {
  id: "conv_sample000debugview",
  agent_id: "agent_sample_frontdesk",
  status: "completed",
  started_at: "2026-09-16T14:02:11.000Z",
  ended_at: "2026-09-16T14:02:41.320Z",
  duration_ms: 30320,
  events: [
    { t: 0, type: "session.started", data: { agent_id: "agent_sample_frontdesk", voice: "geffen_32", model: "simba-3.2" } },
    { t: 120, type: "agent.speech.started", data: { text: "Hi, this is Maya at Sunrise Dental — how can I help?" } },
    { t: 2980, type: "agent.speech.ended", data: { duration_ms: 2860 } },
    { t: 4110, type: "user.speech.started" },
    { t: 6740, type: "user.transcript", data: { text: "I'd like to book a cleaning for next Tuesday.", is_final: true } },
    { t: 6980, type: "agent.thinking", data: { note: "resolve intent → schedule" } },
    { t: 7220, type: "tool.call", data: { name: "show_calendar", call_id: "call_a1", arguments: { week_of: "2026-09-21" } } },
    { t: 7610, type: "tool.result", data: { call_id: "call_a1", result: { open: ["Tue 10:00", "Tue 14:30", "Wed 09:15"] } } },
    { t: 7900, type: "agent.speech.started", data: { text: "I've got Tuesday at ten or half past two — which works?" } },
    { t: 10420, type: "agent.speech.ended", data: { duration_ms: 2520 } },
    { t: 12010, type: "user.transcript", data: { text: "Ten is perfect.", is_final: true } },
    { t: 12360, type: "tool.call", data: { name: "create_booking", call_id: "call_b2", arguments: { slot: "Tue 10:00", reason: "cleaning" } } },
    { t: 12980, type: "tool.result", data: { call_id: "call_b2", result: { booking_id: "bk_5521", confirmed: true } } },
    { t: 13240, type: "agent.speech.started", data: { text: "Booked — Tuesday at ten. Anything else?" } },
    { t: 15600, type: "agent.speech.ended", data: { duration_ms: 2360 } },
    { t: 17020, type: "user.transcript", data: { text: "No, thanks!", is_final: true } },
    { t: 17400, type: "agent.speech.started", data: { text: "Great, see you then. Bye!" } },
    { t: 19120, type: "agent.speech.ended", data: { duration_ms: 1720 } },
    { t: 19300, type: "tool.call", data: { name: "end_call", call_id: "call_c3", arguments: {} } },
    { t: 30320, type: "session.ended", data: { reason: "agent_ended", duration_ms: 30320 } },
  ],
};
