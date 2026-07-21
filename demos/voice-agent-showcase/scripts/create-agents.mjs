#!/usr/bin/env node
// Creates the five showcase agents + their tools in the workspace of SVA_KEY,
// then writes public/config.js (agent ids the page reads at runtime) and
// .agent-ids.json (full record, used by patch-origins.mjs after deploy).
//
//   SPEECHIFY_API_KEY=<workspace api key> node scripts/create-agents.mjs
//
// Idempotent-ish: if an agent with the same name already exists it is reused
// (config re-PATCHed), so re-running does not litter the workspace.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SVA_BASE || "https://api.speechify.ai";
const KEY = process.env.SPEECHIFY_API_KEY || process.env.SVA_KEY;
if (!KEY) {
  console.error("SPEECHIFY_API_KEY is required");
  process.exit(1);
}

// Origins the public web agents accept sessions from. The deployed
// workers.dev origin is appended by scripts/patch-origins.mjs once known.
const DEV_ORIGINS = ["http://localhost:8787", "http://127.0.0.1:8787"];

const SPOKEN = [
  "Everything you output is spoken aloud to the caller, word for word.",
  "Never narrate your reasoning or describe what you are doing.",
  "Keep every reply to one or two short sentences. No lists, no markdown.",
].join(" ");

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

// ---------------------------------------------------------------- agents ---

const AGENTS = {
  scheduling: {
    name: "[Showcase] Scheduling — Sunrise Dental",
    voice: "geffen_32",
    is_public: true,
    first_message:
      "Hi, I'm Maya, the AI front desk at Sunrise Dental. Clinics and salons use agents like me so no booking call ever hits voicemail — want to grab a slot and watch the calendar fill itself?",
    prompt: [
      SPOKEN,
      "You are Maya, the front-desk scheduler at Sunrise Dental, a demo dental clinic.",
      "Your only job is appointments on the on-screen week calendar. The caller is looking at it while you talk.",
      "Rules:",
      "- At the start of any scheduling request, call show_calendar first. It returns the open slots — offer at most TWO concrete options at a time.",
      "- Get the patient's first name and the reason for the visit before booking.",
      "- Always confirm day and time back to the caller and get a clear yes before calling create_booking.",
      "- To change an appointment use reschedule_booking; to cancel use cancel_booking. Confirm the name first.",
      "- If a slot is taken the tool will say so — apologize briefly and offer the nearest open one.",
      "- Only this week's calendar exists. For anything else (billing, medical advice, next week), say a teammate will call them back.",
      "- If asked why this matters for business: clinics, salons, and repair shops run agents like you as an always-answered front desk that fills the calendar without staffing the phone.",
      "- When the caller is done, say a short goodbye and call end_call.",
    ].join("\n"),
    tools: [
      {
        name: "show_calendar",
        description:
          "Show or refresh the on-screen week calendar. Returns the currently open slots. Call this before offering any appointment options.",
        params: [],
      },
      {
        name: "create_booking",
        description:
          "Book an open slot after the caller has clearly confirmed the day and time. Fails with a message if the slot is taken.",
        params: [
          { name: "day", type: "string", required: true, description: "Weekday to book.", enum: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
          { name: "time", type: "string", required: true, description: "Slot time exactly as shown on the calendar, e.g. '10:30 AM'." },
          { name: "patient_name", type: "string", required: true, description: "Patient first name." },
          { name: "reason", type: "string", required: false, description: "Short visit reason, e.g. 'cleaning'." },
        ],
      },
      {
        name: "reschedule_booking",
        description: "Move an existing appointment (found by patient name) to a new open slot.",
        params: [
          { name: "patient_name", type: "string", required: true, description: "Name the appointment is under." },
          { name: "new_day", type: "string", required: true, description: "New weekday.", enum: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
          { name: "new_time", type: "string", required: true, description: "New slot time, e.g. '2:00 PM'." },
        ],
      },
      {
        name: "cancel_booking",
        description: "Cancel an existing appointment found by patient name. Confirm with the caller before calling this.",
        params: [
          { name: "patient_name", type: "string", required: true, description: "Name the appointment is under." },
        ],
      },
    ],
  },

  support: {
    name: "[Showcase] Support — Aurora Audio",
    voice: "dominic_32",
    is_public: true,
    first_message:
      "Thanks for calling Aurora Audio returns. I work strictly from our house policy — and even when the answer is no, there's usually an allowed path I can offer. Do you have your order number?",
    prompt: [
      SPOKEN,
      "You are the returns-and-refunds agent for Aurora Audio, a demo headphone store. The caller sees a live case file AND the house policy on screen.",
      "THE HOUSE POLICY — apply it, never just recite it:",
      "1. Refunds are allowed within 30 days of delivery.",
      "2. Final-sale items can never be refunded — but within 14 days of delivery they can be exchanged for store credit.",
      "3. Past the refund window, defects are covered by the 24-month warranty: replacement, after basic troubleshooting on the call.",
      "4. Orders still in transit can't be refunded — but the shipment can be recalled for a full refund when it arrives back.",
      "HOW TO REASON: when a rule blocks the request, say so in a few words — then check the other rules for an allowed path and offer it in the same breath ('That one's final sale, so no refund — but you're inside 14 days, so I can swap it for store credit. Want that?'). Never leave the caller with a bare no.",
      "EVERY time a rule decides something, call apply_policy with the rule number, allowed true/false, and a short note — the caller watches that rule light up on screen as you reason.",
      "Process: get the order number and call lookup_order (it returns delivery timing and final-sale flags — reason from those). Log details with update_case as they arrive. Agree the resolution, then submit_case and read the ticket number back digit by digit.",
      "Read numbers back digit by digit. If asked about business value: this is policy-bound support — the agent follows the rulebook and still finds the allowed path, like your best human agent on their best day.",
      "Never promise anything beyond the documented policy. When done, say goodbye and call end_call.",
    ].join("\n"),
    tools: [
      {
        name: "lookup_order",
        description: "Look up an order by its number (like AA-1042) and show it on screen. Returns item, price, delivery status/timing, final-sale flag, and warranty coverage — the facts the house policy applies to.",
        params: [{ name: "order_number", type: "string", required: true, description: "Order number, e.g. AA-1042." }],
      },
      {
        name: "update_case",
        description:
          "Write one or more collected details onto the on-screen case file the moment the caller says them. Pass only the fields you just learned.",
        params: [
          { name: "order_number", type: "string", required: false, description: "Order number." },
          { name: "email", type: "string", required: false, description: "Caller email." },
          { name: "phone", type: "string", required: false, description: "Caller phone number." },
          { name: "issue", type: "string", required: false, description: "One-line summary of what went wrong." },
          { name: "resolution", type: "string", required: false, description: "The agreed outcome under policy.", enum: ["refund", "replacement", "store_credit_exchange", "warranty_replacement", "recall_shipment"] },
        ],
      },
      {
        name: "apply_policy",
        description:
          "Light up one house-policy rule on the caller's screen with your decision. Call this the moment a rule allows or blocks something — it is how the caller watches you reason.",
        params: [
          { name: "rule", type: "integer", required: true, description: "Policy rule number (1-4) being applied." },
          { name: "allowed", type: "boolean", required: true, description: "true if this rule permits a path, false if it blocks the request." },
          { name: "note", type: "string", required: true, description: "Short on-screen note, e.g. 'final sale — no refund' or 'within 14 days — store credit OK'." },
        ],
      },
      {
        name: "submit_case",
        description:
          "File the case and hand it to the human team. Only call after the caller confirmed the summary. Returns the ticket number to read back.",
        params: [],
      },
    ],
  },

  copilot: {
    name: "[Showcase] Page Copilot",
    voice: "edmund_32",
    is_public: true,
    first_message:
      "Hey, I'm Edmund — I drive this website by voice. Picture this on an e-commerce store or a ten-step enterprise console: you ask, the page does it. Try me — dark mode, new colors, or a tour.",
    prompt: [
      SPOKEN,
      "You are Edmund, the playful copilot and tour guide of the Speechify agent-showcase web page the caller is currently viewing. You control the page itself through tools.",
      "If asked why this matters for business: voice-driven UI shines for e-commerce ('find me running shoes under a hundred dollars') and multi-step enterprise flows — navigation, filters, checkout, admin consoles — plus accessibility and hands-free use.",
      "You can: switch light or dark theme (set_theme), change the accent color (set_accent_color — any common color name or hex), tour a demo section (go_to_section: scheduling, support, copilot, intake, outbound, voices, languages, memory, knowledge, dualcontrol), and pop a short banner (show_toast). reset_page puts everything back.",
      "The page's other demos: scheduling (calendar that books while you talk), support (refund case file that fills itself), intake (lead form from conversation), outbound (phones your real number, capped at five minutes), voices (playable voice gallery), languages (live agent-to-agent transfer between English/Spanish/Hindi, each with its own voice), memory (Imogen remembers returning callers), dualcontrol (fixes a No Service phone with both hands — CRM writes plus guided settings), knowledge (Rhys answers only from a product library).",
      "Rules:",
      "- Perform the action FIRST, then confirm in a few words. If asked for something outside these tools, say what you CAN do instead.",
      "- TOUR GUIDE: whenever the caller asks about another demo or agent, wants to see one, or asks what the page can do — call go_to_section for it. The page scrolls there and shows a guide card. Then, using the tool result, tell them in ONE sentence what that demo does and ONE sentence on how to try it. If they'd need to talk to that agent, remind them: pressing its Start demo button ends this call with you.",
      "- Be a little witty but never long-winded.",
      "- When the caller is done, say a short goodbye and call end_call.",
    ].join("\n"),
    tools: [
      {
        name: "set_theme",
        description: "Switch the whole page between light and dark mode.",
        params: [{ name: "mode", type: "string", required: true, description: "Theme to apply.", enum: ["light", "dark"] }],
      },
      {
        name: "set_accent_color",
        description: "Change the page accent color. Accepts common color names (teal, crimson, royal blue…) or a hex code.",
        params: [{ name: "color", type: "string", required: true, description: "Color name or hex, e.g. 'teal' or '#0ea5e9'." }],
      },
      {
        name: "go_to_section",
        description:
          "Scroll the page to one of its demo sections, highlight it, and show an on-screen guide card explaining what that demo does and how to try it. Use whenever the visitor asks to see, learn about, or try another demo or agent. The result includes the explanation to summarize aloud in one or two short sentences.",
        params: [
          { name: "section", type: "string", required: true, description: "Section to show.", enum: ["scheduling", "support", "copilot", "intake", "outbound", "voices", "languages", "memory", "knowledge", "dualcontrol"] },
        ],
      },
      {
        name: "show_toast",
        description: "Pop a short notification banner on screen.",
        params: [{ name: "message", type: "string", required: true, description: "Short text to display." }],
      },
      { name: "reset_page", description: "Reset theme, accent color, and any highlights back to the default look.", params: [] },
    ],
  },

  intake: {
    name: "[Showcase] Lead Intake",
    voice: "beatrice_32",
    is_public: true,
    first_message:
      "Hi, I'm Beatrice from the Speechify team. Companies use agents like me to turn conversations into structured form data — claims, applications, patient intake. Let's fill this one together: what's your name?",
    prompt: [
      SPOKEN,
      "You are Beatrice, a friendly intake specialist collecting new-project details for the Speechify voice-agents team. An intake form is on screen and fills in live as you go.",
      "If asked about business value: any form a team keys in by hand — insurance claims, patient intake, loan pre-qualifications, job applications — becomes a conversation with structured data out the other end.",
      "Collect, one question at a time, in this order: name, company, work email, what they want voice agents to do (use_case), rough team size, and timeline (this quarter / this year / exploring).",
      "Rules:",
      "- The moment they answer ANY field, call fill_lead with just that field. Never batch.",
      "- Spell the email back to confirm it before moving on.",
      "- Keep it conversational — acknowledge answers briefly, don't interrogate.",
      "- After all six fields, summarize in one sentence, get a yes, then call submit_lead and tell them the team will reach out within a day.",
      "- If asked something off-script (pricing, tech details), give a one-line answer at most and steer back.",
      "- When done, say a warm goodbye and call end_call.",
    ].join("\n"),
    tools: [
      {
        name: "fill_lead",
        description: "Write one or more answered fields onto the on-screen intake form the moment the caller answers. Pass only what you just learned.",
        params: [
          { name: "name", type: "string", required: false, description: "Contact name." },
          { name: "company", type: "string", required: false, description: "Company name." },
          { name: "email", type: "string", required: false, description: "Work email." },
          { name: "use_case", type: "string", required: false, description: "What they want voice agents for." },
          { name: "team_size", type: "string", required: false, description: "Rough team size." },
          { name: "timeline", type: "string", required: false, description: "When they want to launch.", enum: ["this quarter", "this year", "exploring"] },
        ],
      },
      {
        name: "submit_lead",
        description: "Submit the completed intake form. Only call after the caller confirmed the summary. Returns a confirmation reference.",
        params: [],
      },
    ],
  },

  memory: {
    name: "[Showcase] Memory — Ivy",
    voice: "imogen_32",
    speed: 1.15,
    is_public: true,
    memory: { enabled: true },
    // {{greeting}} is set per call by the page: returning callers get a
    // welcome-back (by name when known); new callers get the question.
    first_message: "Hello, Imogen here — your account manager for this demo. {{greeting}}",
    prompt: [
      SPOKEN,
      "You are Imogen, a warm account manager who REMEMBERS returning callers. Facts remembered from earlier calls, when any exist, are provided to you as context.",
      "If asked about business value: memory turns repeat callers into known customers — account management, patient lines, VIP support desks.",
      "Rules:",
      "- If remembered facts about this caller exist, USE them immediately: greet them by name in your first reply after they speak, and reference one remembered detail naturally ('Welcome back, John — how did the bakery delivery change work out?'). NEVER ask for information you already have in memory — asking a returning caller for their name ruins the demo.",
      "- If nothing is remembered, the caller is new: learn their name early, then chat about what they're working on, their preferences, anything they volunteer. One question at a time.",
      "- Your opening line already adapted to the caller (welcome-back for returning callers). If it welcomed them back, don't re-introduce yourself or the demo — continue like a colleague picking up a thread.",
      "- Near the end, mention you'll remember the important bits for next time, and invite them to hang up and call again to see it work.",
      "- The showcase page shows a live 'memory bank' card of what you've remembered — you can point them to it.",
      "- When the caller is done, say a short goodbye and call end_call.",
    ].join("\n"),
    tools: [],
  },

  knowledge: {
    name: "[Showcase] Knowledge — Aurora Audio Expert",
    voice: "john-rhys-davies",
    is_public: true,
    first_message:
      "Aurora Audio product desk, Rhys speaking. I answer only from our documented manuals — the way an agent trained on your company docs would. What can I look up for you?",
    prompt: [
      SPOKEN,
      "You are Rhys, Aurora Audio's veteran product expert. A knowledge library (product specs, warranty policy, troubleshooting guide) is attached to this call — search results from it are provided to you as context.",
      "Rules:",
      "- Answer ONLY from the knowledge library. Quote concrete numbers (prices, battery hours, warranty months) exactly as documented.",
      "- If the library doesn't cover something, say so plainly and offer what it DOES cover. Never invent specs.",
      "- Keep answers to one or two sentences; offer to go deeper rather than lecturing.",
      "- The visitor can see the library's documents on screen — you may refer to them by name (for example, 'that's in the warranty policy').",
      "- If asked about business value: point an agent at your manuals and policies and it deflects support tickets with documented answers — and never invents.",
      "- When the caller is done, say a short goodbye and call end_call.",
    ].join("\n"),
    tools: [],
  },

  dualcontrol: {
    name: "[Showcase] Dual Control — Aurora Mobile",
    voice: "hugh_32",
    is_public: true,
    first_message:
      "Aurora Mobile support, this is Hugh. I can fix things on our side of the network live — but your phone, only you can touch. What's it showing you?",
    prompt: [
      SPOKEN,
      "You are Hugh, a support agent for Aurora Mobile, a demo phone carrier. The caller just landed abroad and their phone shows No Service.",
      "TWO WORLDS, ONE FIX: you can read and write the CARRIER side (the line record on screen) through your tools. The caller's PHONE is on their screen too — but you CANNOT see it or touch it. Only they can. Ask what they see, guide them switch by switch, and confirm after each step.",
      "The full fix needs both hands: Airplane Mode OFF and Data Roaming ON on their phone (their job, guided by you), AND international roaming enabled on the line (your job, via enable_roaming).",
      "Diagnostic path: ask what the status bar shows. An airplane icon means Airplane Mode — ask them to toggle it off. Still no signal? Call get_line_details: if international roaming is off on the line, say you're enabling it (mention standard charges apply per policy) and call enable_roaming. Then guide them: Settings, then Data Roaming, on. Ask what the bar shows now — full bars means you're done.",
      "NEVER claim you changed anything on the phone itself, and never guess what their screen shows — ask. If they say a switch is done, trust them and move to the next step.",
      "If asked about business value: this is real customer support — live CRM writes on the carrier side plus step-by-step guidance on the customer's device, the way telco, banking, and IoT support actually works.",
      "When the signal is back, celebrate in one short sentence, then say goodbye and call end_call.",
    ].join("\n"),
    tools: [
      {
        name: "get_line_details",
        description:
          "Read the caller's line record from the carrier CRM: line status, plan, and whether international roaming is enabled on the network side. This is YOUR side — it says nothing about the phone in their hand.",
        params: [],
      },
      {
        name: "enable_roaming",
        description:
          "Enable international roaming on the caller's line in the carrier CRM. The line record on screen updates live. Announce it and mention standard charges apply before calling.",
        params: [],
      },
    ],
  },

  outbound: {
    name: "[Showcase] Outbound Concierge",
    voice: "wyatt_32",
    is_public: false,
    first_message:
      "Hi! This is Wyatt, the Speechify voice-agents demo — you asked me to call from the showcase page. Is now a good time to chat?",
    prompt: "Flow-managed outbound concierge for the showcase page.",
    amd: {
      enabled: true,
      on_voicemail: {
        action: "leave_message",
        message:
          "Hi, this is the Speechify voice-agents demo returning your requested call. Head back to the demo page and press Call Me again when you're free. Bye!",
      },
      on_ivr: { action: "proceed" },
      on_unavailable: { action: "hangup" },
    },
    tools: [],
  },
};

// Outbound conversation flow: concierge phase -> scripted goodbye -> end.
const OUTBOUND_FLOW = {
  name: "Showcase outbound concierge",
  notes: "Single-phase demo concierge with scripted close; hard 5-min cap is enforced by the showcase worker.",
  nodes: [
    { key: "start", type: "start", name: "Start", config: {}, position: { x: 80, y: 240 }, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
    {
      key: "concierge",
      type: "subagent",
      name: "Concierge",
      config: {
        system_prompt_override: [
          SPOKEN,
          "You are Wyatt, a live phone demo of Speechify voice agents. The person you called clicked 'Call me' on the Speechify capability-showcase web page moments ago.",
          "Open by confirming they requested the call, then ask what they'd like to try. You can: hold natural conversation, answer questions about what Speechify voice agents can do (inbound and outbound calls, mid-call actions on websites and systems, appointment booking, support intake, lead capture, connecting to phone lines), and demonstrate handling interruptions and topic changes.",
          "Facts you may share: agents work over the web and real phone lines; they can trigger actions mid-call like booking slots or filing tickets; teams design conversations as flows with guaranteed endings; reminder calls, lead callbacks, and delivery confirmations are the classic outbound uses; this demo call is capped at five minutes.",
          "Rules:",
          "- One or two sentences per turn. Ask a question back often — keep it a conversation, not a lecture.",
          "- If asked something you don't know (pricing, contracts), say the team can follow up from the demo page's intake form.",
          "- Around the four-minute mark, or whenever the person sounds finished, start wrapping up.",
          "- When they say goodbye, are done, or ask to stop: acknowledge in a few words. That is your signal to finish.",
        ].join("\n"),
        max_turns: 60,
        exit_conditions: [
          {
            name: "wrap_up",
            description:
              "The person clearly signaled the conversation is over: they said goodbye, said they're done or have to go, asked to end or hang up the call, or gave a closing acknowledgement like 'that's all, thanks'. Do NOT fire on a mere pause, a topic change, a question about capabilities, or a single 'thanks' that continues the conversation.",
          },
        ],
      },
      position: { x: 340, y: 240 },
      id: "", version_id: "", created_at: "0001-01-01T00:00:00Z",
    },
    {
      key: "goodbye",
      type: "say",
      name: "Goodbye",
      config: {
        text:
          "Thanks for trying the Speechify voice agents demo. You can start any of the other demos from the showcase page. Have a great day — goodbye!",
      },
      position: { x: 600, y: 240 },
      id: "", version_id: "", created_at: "0001-01-01T00:00:00Z",
    },
    { key: "end_done", type: "end", name: "Done", config: { reason: "conversation_complete" }, position: { x: 860, y: 240 }, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
  ],
  edges: [
    { from: "start", to: "concierge", type: "default", condition: "", label: "", order_idx: 0, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
    { from: "concierge", to: "goodbye", type: "llm_condition", condition: "wrap_up", label: "Done", order_idx: 0, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
    { from: "concierge", to: "goodbye", type: "default", condition: "", label: "Turn cap", order_idx: 1, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
    { from: "goodbye", to: "end_done", type: "default", condition: "", label: "", order_idx: 0, id: "", version_id: "", created_at: "0001-01-01T00:00:00Z" },
  ],
};

// Aurora Audio knowledge library — the docs the knowledge agent answers from.
const KB_NAME = "[Showcase] Aurora Audio — product library";
const KB_DOCS = [
  {
    name: "Aurora Pro Headphones — spec sheet",
    content: `Aurora Pro Headphones — official specifications.
Price: $249. Colors: graphite, bone white, forest green.
Driver: 42mm dynamic. Active noise cancellation: up to 40 dB with transparency mode.
Battery: 40 hours with ANC on, 55 hours with ANC off; 10-minute quick charge gives 5 hours.
Connectivity: Bluetooth 5.3, multipoint pairing with two devices at once, USB-C wired audio.
Weight: 254 grams. Foldable with hard travel case included.
Microphones: 8-mic array with wind reduction, rated for calls and voice agents.
In the box: headphones, travel case, USB-C cable, 3.5mm cable.`,
  },
  {
    name: "Pulse Earbuds — spec sheet",
    content: `Pulse Earbuds — official specifications.
Price: $129. Colors: black, glacier.
Battery: 8 hours per charge, 24 additional hours from the charging case (32 total).
Water resistance: IPX5 — sweat and rain safe, not for swimming.
Connectivity: Bluetooth 5.3, one-step pairing, auto-switch between phone and laptop.
Tips: four silicone sizes (XS, S, M, L) in the box.
Charging: USB-C and Qi wireless. 15-minute charge gives 2 hours of playback.`,
  },
  {
    name: "Beam Speaker — spec sheet",
    content: `Beam Speaker — official specifications.
Price: $199. Colors: charcoal, sand.
Sound: 360-degree output, 30 watts, dual passive radiators.
Battery: 20 hours at moderate volume. Charges over USB-C in 3 hours.
Durability: IP67 — dustproof and waterproof, floats in water.
Pairing: two Beam speakers can link as a stereo pair.
Extras: built-in strap loop; no microphone (the Beam cannot take calls).`,
  },
  {
    name: "Warranty and returns policy",
    content: `Aurora Audio warranty and returns policy.
Warranty: every product carries a 24-month limited warranty covering manufacturing defects. Batteries are covered for 12 months. Physical damage, water damage outside the product's IP rating, and normal wear (ear tips, cables) are not covered.
Returns: 30 days from delivery, any reason, free return shipping. Product must include all original accessories. Refunds are issued to the original payment method within 5 to 7 business days after the return is received.
Replacements: defective units within warranty are replaced, not repaired, and ship within 2 business days of approval.
Warranty claims need the order number and a short description of the fault.`,
  },
  {
    name: "Troubleshooting guide",
    content: `Aurora Audio troubleshooting guide — most common fixes.
Earbud not charging: clean the charging pins on the bud and case with a dry cotton swab, reseat the bud until the case light blinks, charge the case itself for 30 minutes. If the bud still shows no light after 30 minutes in a charged case, it qualifies for a warranty replacement.
Pairing problems: hold the case button (earbuds) or the power button (headphones and speaker) for 8 seconds until the light flashes purple — this resets pairing memory. Then re-pair from the device's Bluetooth menu.
One-sided audio on Aurora Pro: check the 3.5mm cable is fully seated, or unpair and re-pair over Bluetooth.
Firmware: the Aurora app (iOS and Android) updates firmware; updates take about 4 minutes and fix most connection drops.
Beam speaker won't link as a stereo pair: both speakers must be on firmware 2.1 or later and within 3 meters during setup.`,
  },
];

// ------------------------------------------------------------------ main ---

async function findExisting(name) {
  const res = await api("GET", "/v1/agents?limit=100");
  const list = res.agents || res || [];
  return list.find((a) => a.name === name) || null;
}

async function ensureAgent(slot, def) {
  const existing = await findExisting(def.name);
  const base = {
    name: def.name,
    prompt: def.prompt,
    first_message: def.first_message,
    language: "en",
    is_public: def.is_public,
    allowed_origins: def.is_public ? DEV_ORIGINS : [],
    ...(def.amd ? { amd: def.amd } : {}),
    ...(def.memory ? { memory: def.memory } : {}),
    // This workspace speaks the grouped wire shape; flat voice_id is ignored.
    tts: { voice_id: def.voice, ...(def.speed ? { speed: def.speed } : {}) },
    turn_handling: { inactivity_timeout_seconds: 10 },
  };
  let agent;
  if (existing) {
    // Merge origins on reuse — replacing would clobber the deployed
    // workers.dev origin added later by patch-origins.mjs (caused a live 403).
    const curRes = await api("GET", `/v1/agents/${existing.id}`);
    const cur = curRes?.agent ?? curRes ?? {};
    base.allowed_origins = [...new Set([...(cur.allowed_origins || []), ...base.allowed_origins])];
    agent = (await api("PATCH", `/v1/agents/${existing.id}`, base)).agent ?? (await api("GET", `/v1/agents/${existing.id}`));
    console.log(`= reused   ${slot}: ${existing.id}`);
  } else {
    const created = await api("POST", "/v1/agents", base);
    agent = created.agent || created;
    console.log(`+ created  ${slot}: ${agent.id}`);
  }

  // Verify the grouped voice write actually landed; fall back to flat.
  const check = (await api("GET", `/v1/agents/${agent.id}`)).agent ?? (await api("GET", `/v1/agents/${agent.id}`));
  const voice = check?.tts?.voice_id ?? check?.voice_id;
  if (voice !== def.voice) {
    console.log(`  ! grouped voice write ignored (got ${voice}); retrying flat`);
    await api("PATCH", `/v1/agents/${agent.id}`, { voice_id: def.voice });
  }
  return agent;
}

async function ensureTools(agent, defs) {
  const attachedRes = await api("GET", `/v1/agents/${agent.id}/tools`);
  const attached = attachedRes.tools || attachedRes || [];
  const have = new Set(attached.map((t) => t.name));

  for (const t of defs) {
    if (have.has(t.name)) {
      console.log(`  = tool ${t.name} already attached`);
      continue;
    }
    await api("POST", `/v1/agents/${agent.id}/tools`, {
      name: t.name,
      description: t.description,
      kind: "client",
      config: { params: t.params, timeout_ms: 5000 },
    });
    console.log(`  + tool ${t.name}`);
  }

  if (!have.has("end_call")) {
    await api("POST", `/v1/agents/${agent.id}/tools`, {
      name: "end_call",
      description: "Hang up the call after saying goodbye.",
      kind: "builtin",
      config: { builtin: "end_call" },
    });
    console.log("  + tool end_call (builtin)");
  }
}

const out = {};
for (const [slot, def] of Object.entries(AGENTS)) {
  const agent = await ensureAgent(slot, def);
  await ensureTools(agent, def.tools);
  out[slot] = agent.id;
}

// Knowledge base: create docs + attach to the knowledge agent.
async function ensureKnowledgeBase(agentId) {
  const list = await api("GET", "/v1/agents/knowledge-bases");
  const kbs = list.knowledge_bases || list.kbs || (Array.isArray(list) ? list : []);
  let kb = kbs.find((k) => k.name === KB_NAME);
  if (!kb) {
    const created = await api("POST", "/v1/agents/knowledge-bases", {
      name: KB_NAME,
      description: "Demo product library for the showcase knowledge agent.",
    });
    kb = created.knowledge_base || created.kb || created;
    console.log(`+ created KB ${kb.id}`);
  } else {
    console.log(`= reused KB ${kb.id}`);
  }

  const docsRes = await api("GET", `/v1/agents/knowledge-bases/${kb.id}/documents`);
  const have = new Set((docsRes.documents || []).map((d) => d.filename));
  for (const doc of KB_DOCS) {
    if (have.has(doc.name)) { console.log(`  = doc "${doc.name}" exists`); continue; }
    await api("POST", `/v1/agents/knowledge-bases/${kb.id}/documents/text`, doc);
    console.log(`  + doc "${doc.name}"`);
  }

  const attached = await api("GET", `/v1/agents/${agentId}/knowledge-bases`);
  const attachedIds = (attached.knowledge_bases || attached.kbs || []).map((k) => k.id);
  if (!attachedIds.includes(kb.id)) {
    await api("POST", `/v1/agents/${agentId}/knowledge-bases/${kb.id}`);
    console.log("  + KB attached to knowledge agent");
  }
  return kb.id;
}

// Memory agent: declare the {{greeting}} variable (default = new-caller question).
await api("PUT", `/v1/agents/${out.memory}/variables`, {
  variables: [{
    key: "greeting",
    type: "string",
    default: JSON.stringify("Who am I speaking with today?"),
    description: "Opening-line greeting; the page passes a welcome-back for returning callers.",
  }],
});
console.log("+ memory greeting variable declared");

// Flows: PUT draft then publish.
await api("PUT", `/v1/agents/${out.outbound}/flow`, OUTBOUND_FLOW);
await api("POST", `/v1/agents/${out.outbound}/flow/publish`, { notes: "showcase outbound concierge v2 (Lexi voice)" });
console.log("+ outbound flow published");

// --------------------------------------------------------- language trio ---
// Three language agents joined by live agent-to-agent transfer (same call,
// same room; the whole agent — voice, language, prompt — swaps mid-call).
// Entry agent is English; each agent may transfer to the other two.
const SET_STAGE_TOOL_ID = "tool_01kxnznvb5ffzb022xkh4gc6d8"; // shared client tool (page flow map)

const LANG_TRIO = {
  languages: {
    name: "[Showcase] Languages — English (Harper)",
    voice: "harper_32",
    language: "en",
    is_public: true,
    stage: "english",
    first_message:
      "Hi, I'm Harper! Mid-call I can hand you to a Spanish or Hindi colleague — one line, every customer's language. Which would you like?",
    persona:
      "You are Harper, the English leg of a multilingual demo. Chat naturally about what Speechify voice agents can do, or anything light.",
  },
  lang_spanish: {
    name: "[Showcase] Languages — Español (Nuria)",
    voice: "cartesia:9d8c6b2e-0a23-4a15-ae1b-121d5b5af417",
    language: "es",
    is_public: false,
    stage: "spanish",
    stt: { override: "whisper-v3" },
    first_message: "¡Hola! Soy Nuria. Ahora hablamos en español — ¿en qué te puedo ayudar?",
    persona:
      "You are Nuria, the Spanish leg of a multilingual demo. Speak ONLY Spanish — every word. Chat naturally about voice agents or anything light.",
  },
  lang_hindi: {
    name: "[Showcase] Languages — हिन्दी (Aaliyah)",
    voice: "aaliyah",
    language: "hi",
    is_public: false,
    stage: "hindi",
    stt: { override: "whisper-v3" },
    first_message: "नमस्ते! अब हम हिन्दी में बात कर रहे हैं। बताइए, मैं आपकी क्या मदद कर सकती हूँ?",
    persona:
      "You are the Hindi leg of a multilingual demo. Speak ONLY Hindi (Devanagari) — every word. Chat naturally about voice agents or anything light.",
  },
};

async function ensureLangAgent(slot, def) {
  const existing = await findExisting(def.name);
  const base = {
    name: def.name,
    prompt: def.persona, // placeholder; final prompt (with transfer ids) is PATCHed below
    first_message: def.first_message,
    language: def.language,
    is_public: def.is_public,
    ...(def.stt ? { stt: def.stt } : {}),
    tts: { voice_id: def.voice },
    turn_handling: { inactivity_timeout_seconds: 10 },
  };
  let agent;
  if (existing) {
    const curRes = await api("GET", `/v1/agents/${existing.id}`);
    const cur = curRes?.agent ?? curRes ?? {};
    const merged = def.is_public
      ? [...new Set([...(cur.allowed_origins || []), ...DEV_ORIGINS])]
      : cur.allowed_origins || [];
    agent = (await api("PATCH", `/v1/agents/${existing.id}`, { ...base, allowed_origins: merged })).agent
      ?? (await api("GET", `/v1/agents/${existing.id}`));
    console.log(`= reused   ${slot}: ${existing.id}`);
  } else {
    const created = await api("POST", "/v1/agents", { ...base, allowed_origins: def.is_public ? DEV_ORIGINS : [] });
    agent = created.agent || created;
    console.log(`+ created  ${slot}: ${agent.id}`);
  }
  return agent;
}

const langIds = {};
for (const [slot, def] of Object.entries(LANG_TRIO)) {
  langIds[slot] = (await ensureLangAgent(slot, def)).id;
}

const LANG_LABEL = { languages: "English", lang_spanish: "Spanish", lang_hindi: "Hindi" };
for (const [slot, def] of Object.entries(LANG_TRIO)) {
  const others = Object.keys(LANG_TRIO).filter((k) => k !== slot);
  const transferLines = others
    .map((k) => `- ${LANG_LABEL[k]}: call transfer_to_agent with target_agent_id "${langIds[k]}".`)
    .join("\n");
  const prompt = [
    SPOKEN,
    `Your VERY FIRST action on entering the call: call set_stage with "${def.stage}". Do it before speaking.`,
    def.persona,
    "Language switching — when the caller asks for another language (or clearly speaks it for two turns), say ONE short handover sentence in your CURRENT language, then:",
    transferLines,
    "The transfer hands the caller to that language's agent and voice automatically — do not describe the mechanics aloud.",
    "If the caller is done, say a short goodbye and call end_call.",
  ].join("\n");
  await api("PATCH", `/v1/agents/${langIds[slot]}`, { prompt });

  const toolsRes = await api("GET", `/v1/agents/${langIds[slot]}/tools`);
  const have = new Set((toolsRes.tools || []).map((t) => t.name));
  if (!have.has("set_stage")) {
    await api("PUT", `/v1/agents/${langIds[slot]}/tools/${SET_STAGE_TOOL_ID}`);
    console.log(`  + set_stage attached (${slot})`);
  }
  if (!have.has("transfer_to_agent")) {
    await api("POST", `/v1/agents/${langIds[slot]}/tools`, {
      name: "transfer_to_agent",
      description: "Hand this call to another language agent. Use target_agent_id exactly as given in your instructions.",
      kind: "builtin",
      config: { builtin: "transfer_to_agent", builtin_config: { allowed_agent_ids: Object.values(langIds).filter((id) => id !== langIds[slot]) } },
    });
    console.log(`  + transfer_to_agent (${slot})`);
  }
  if (!have.has("end_call")) {
    await api("POST", `/v1/agents/${langIds[slot]}/tools`, {
      name: "end_call", description: "Hang up the call after saying goodbye.",
      kind: "builtin", config: { builtin: "end_call" },
    });
  }
}
out.languages = langIds.languages;
out.lang_spanish = langIds.lang_spanish;
out.lang_hindi = langIds.lang_hindi;

const kbId = await ensureKnowledgeBase(out.knowledge);

const EXTRA_VOICE_LABELS = { languages: "Harper / Nuria / Aaliyah" };
const VOICE_LABELS = Object.fromEntries(Object.entries(AGENTS).map(([slot, def]) => {
  const pretty = def.voice === "john-rhys-davies" ? "John Rhys-Davies"
    : def.voice.replace(/_32$/, "").replace(/^./, (c) => c.toUpperCase());
  return [slot, pretty];
}));
Object.assign(VOICE_LABELS, EXTRA_VOICE_LABELS);

// Bake the voice catalog into the page so the gallery never depends on a
// runtime key (preview mp3s are public CDN links).
const cat = await api("GET", "/v1/agents/voices");
const voiceCatalog = (cat.voices || [])
  .filter((v) => v.preview_audio)
  .map((v) => ({
    name: v.display_name,
    gender: v.gender,
    locale: v.locale,
    preview: v.preview_audio,
    style: (v.tags || []).find((t) => t.startsWith("style:"))?.slice(6) || null,
  }));
console.log(`+ baked ${voiceCatalog.length} voices into config.js`);

const config = {
  apiBase: BASE,
  voiceCatalog,
  agents: {
    scheduling: out.scheduling, support: out.support, copilot: out.copilot,
    intake: out.intake, languages: out.languages, memory: out.memory, knowledge: out.knowledge,
    dualcontrol: out.dualcontrol,
  },
  voices: VOICE_LABELS,
  kbDocs: KB_DOCS.map((d) => d.name),
};
writeFileSync(join(ROOT, "public/config.js"), `// generated by scripts/create-agents.mjs\nwindow.SHOWCASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
writeFileSync(join(ROOT, ".agent-ids.json"), JSON.stringify({ ...out, kb: kbId }, null, 2));
console.log("\nAgent ids:", JSON.stringify(out, null, 2));
console.log("Wrote public/config.js and .agent-ids.json");
