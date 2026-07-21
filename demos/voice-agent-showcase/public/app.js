// Showcase page logic. One live agent call at a time; each section registers
// its client-tool handlers when its call starts. The Speechify widget SDK is
// loaded once from the prod ESM bundle.

const CFG = window.SHOWCASE_CONFIG || { apiBase: "https://api.speechify.ai", agents: {} };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ toast */
function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = String(message).slice(0, 140);
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* -------------------------------------------------------------- deep link */
function flashSection(id) {
  const sec = document.getElementById(id);
  if (!sec) return false;
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
  // Some embedded webviews never run the smooth-scroll animation — if we
  // haven't arrived shortly, jump instantly instead.
  setTimeout(() => {
    const top = sec.getBoundingClientRect().top;
    if (Math.abs(top) > window.innerHeight * 0.8) sec.scrollIntoView({ behavior: "instant", block: "start" });
  }, 800);
  sec.classList.remove("flash");
  requestAnimationFrame(() => sec.classList.add("flash"));
  setTimeout(() => sec.classList.remove("flash"), 1700);
  return true;
}
function initDeepLink() {
  const id = location.hash.slice(1);
  if (id) setTimeout(() => flashSection(id), 250);
}
if (document.readyState === "complete") initDeepLink();
else window.addEventListener("load", initDeepLink);
window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (id) flashSection(id);
});

/* Copy-link icon on every section title: hover the title, click, and the
   exact deep link for that section is on the clipboard. */
const LINK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* unsupported */ }
    ta.remove();
    return ok;
  }
}

for (const sec of $$("main section[id]")) {
  const h2 = $(".section-copy h2", sec);
  if (!h2) continue;
  const btn = document.createElement("button");
  btn.className = "copy-link";
  btn.type = "button";
  btn.title = "Copy link to this section";
  btn.setAttribute("aria-label", `Copy link to the ${sec.id} section`);
  btn.innerHTML = LINK_SVG;
  btn.addEventListener("click", async () => {
    const url = `${location.origin}/#${sec.id}`;
    const ok = await copyText(url);
    toast(ok ? `Link copied — opens right on this section` : url);
  });
  h2.appendChild(btn);
}

/* ---------------------------------------------------------- calendar demo */
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABEL = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri" };
const TIMES = ["9:00 AM", "10:30 AM", "12:00 PM", "2:00 PM", "3:30 PM", "5:00 PM"];
const SEED = [
  ["monday", "9:00 AM", "Elena", "cleaning"], ["monday", "12:00 PM", "Marcus", "filling"],
  ["monday", "3:30 PM", "Ana", "check-up"], ["tuesday", "10:30 AM", "Jonah", "cleaning"],
  ["tuesday", "5:00 PM", "Priya", "crown"], ["wednesday", "9:00 AM", "Sam", "check-up"],
  ["wednesday", "12:00 PM", "Ruth", "cleaning"], ["thursday", "10:30 AM", "Leo", "whitening"],
  ["thursday", "2:00 PM", "Ivy", "cleaning"], ["thursday", "5:00 PM", "Omar", "check-up"],
  ["friday", "9:00 AM", "Nina", "filling"], ["friday", "3:30 PM", "Theo", "cleaning"],
];
let bookings;

function slotKey(day, time) { return `${day}|${time}`; }

function normTime(t) {
  const m = String(t || "").trim().toUpperCase().replace(/\s+/g, " ").match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!m) return null;
  const canonical = `${Number(m[1])}:${m[2] || "00"} ${m[3]}`;
  return TIMES.includes(canonical) ? canonical : null;
}

function renderCalendar(popKeys = []) {
  const cal = $("#calendar");
  cal.innerHTML = "";
  cal.appendChild(document.createElement("div"));
  for (const d of DAYS) {
    const h = document.createElement("div");
    h.className = "head mono";
    h.textContent = DAY_LABEL[d];
    cal.appendChild(h);
  }
  for (const t of TIMES) {
    const label = document.createElement("div");
    label.className = "time mono";
    label.textContent = t;
    cal.appendChild(label);
    for (const d of DAYS) {
      const cell = document.createElement("div");
      const b = bookings.get(slotKey(d, t));
      cell.className = "slot" + (b ? " busy" : "") + (popKeys.includes(slotKey(d, t)) ? " pop" : "");
      if (b) cell.innerHTML = `<div class="who">${b.name}</div><div class="why">${b.reason || ""}</div>`;
      cal.appendChild(cell);
    }
  }
  const open = DAYS.length * TIMES.length - bookings.size;
  $("#cal-open-count").textContent = `${open} slots open`;
}

function resetCalendar() {
  bookings = new Map(SEED.map(([d, t, name, reason]) => [slotKey(d, t), { name, reason }]));
  renderCalendar();
}
resetCalendar();

function openSlots() {
  const out = [];
  for (const d of DAYS) for (const t of TIMES) if (!bookings.has(slotKey(d, t))) out.push({ day: d, time: t });
  return out;
}

function findBookingByName(name) {
  const n = String(name || "").trim().toLowerCase();
  for (const [key, b] of bookings) if (b.name.toLowerCase() === n) return key;
  for (const [key, b] of bookings) if (b.name.toLowerCase().startsWith(n) && n.length >= 2) return key;
  return null;
}

const schedulingTools = {
  show_calendar: () => {
    renderCalendar();
    const open = openSlots();
    return { ok: true, open_slots: open, message: `Calendar shown. ${open.length} open slots this week.` };
  },
  create_booking: ({ day, time, patient_name, reason }) => {
    const d = DAYS.includes(String(day).toLowerCase()) ? String(day).toLowerCase() : null;
    const t = normTime(time);
    if (!d || !t) return { ok: false, message: `That day/time doesn't match the calendar. Days are Monday–Friday; times are ${TIMES.join(", ")}.` };
    if (bookings.has(slotKey(d, t))) return { ok: false, message: `${DAY_LABEL[d]} ${t} is already taken. Nearest open: ${JSON.stringify(openSlots().slice(0, 3))}` };
    bookings.set(slotKey(d, t), { name: String(patient_name || "Guest"), reason: String(reason || "") });
    renderCalendar([slotKey(d, t)]);
    return { ok: true, message: `Booked ${patient_name} on ${DAY_LABEL[d]} at ${t}.` };
  },
  reschedule_booking: ({ patient_name, new_day, new_time }) => {
    const from = findBookingByName(patient_name);
    if (!from) return { ok: false, message: `No appointment found under "${patient_name}".` };
    const d = DAYS.includes(String(new_day).toLowerCase()) ? String(new_day).toLowerCase() : null;
    const t = normTime(new_time);
    if (!d || !t) return { ok: false, message: "That new day/time doesn't match the calendar." };
    if (bookings.has(slotKey(d, t))) return { ok: false, message: `${DAY_LABEL[d]} ${t} is already taken.` };
    const b = bookings.get(from);
    bookings.delete(from);
    bookings.set(slotKey(d, t), b);
    renderCalendar([slotKey(d, t)]);
    return { ok: true, message: `Moved ${b.name} to ${DAY_LABEL[d]} at ${t}.` };
  },
  cancel_booking: ({ patient_name }) => {
    const key = findBookingByName(patient_name);
    if (!key) return { ok: false, message: `No appointment found under "${patient_name}".` };
    const b = bookings.get(key);
    bookings.delete(key);
    renderCalendar();
    return { ok: true, message: `Cancelled ${b.name}'s appointment.` };
  },
};

/* ------------------------------------------------------------ support demo */
// Each order is a policy scenario: clean refund, final-sale trap,
// out-of-window defect (warranty path), and still-in-transit (recall path).
const ORDERS = {
  "AA-1042": { customer: "Jordan Miles", item: "Aurora Pro Headphones", price: "$249.00", status: "delivered", delivered_days_ago: 5, final_sale: false, warranty_months: 24 },
  "AA-7391": { customer: "Priya Shah", item: "Pulse Earbuds (final sale)", price: "$89.00", status: "delivered", delivered_days_ago: 6, final_sale: true, warranty_months: 24 },
  "AA-8102": { customer: "Sam Ortiz", item: "Aurora Pro Headphones", price: "$249.00", status: "delivered", delivered_days_ago: 45, final_sale: false, warranty_months: 24 },
  "AA-9257": { customer: "Dana Whitfield", item: "Beam Speaker", price: "$199.00", status: "in transit", delivered_days_ago: null, final_sale: false, warranty_months: 24 },
};
const caseData = {};

function setKV(selector, field, value) {
  const dd = $(`[data-${selector}="${field}"]`);
  if (!dd) return;
  dd.textContent = value;
  dd.classList.add("set");
  dd.classList.remove("pop");
  requestAnimationFrame(() => dd.classList.add("pop"));
}

const supportTools = {
  lookup_order: ({ order_number }) => {
    const num = String(order_number || "").toUpperCase().replace(/\s/g, "");
    const order = ORDERS[num];
    if (!order) return { ok: false, message: `No order found for ${num}. Valid demo orders: AA-1042, AA-7391, AA-8102, AA-9257.` };
    $("#order-card").style.display = "";
    $("#order-number").textContent = num;
    const statusLine = order.status === "in transit" ? "In transit" : `Delivered ${order.delivered_days_ago} days ago`;
    $("#order-kv").innerHTML = Object.entries({
      Customer: order.customer, Item: order.item, Total: order.price,
      Status: statusLine, "Final sale": order.final_sale ? "yes" : "no", Warranty: `${order.warranty_months} months`,
    }).map(([k, v]) => `<dt>${k}</dt><dd class="set pop">${v}</dd>`).join("");
    caseData.order_number = num;
    setKV("case", "order_number", num);
    return {
      ok: true, ...order,
      message: `Order ${num}: ${order.item}, ${order.price}, ${statusLine.toLowerCase()}, final sale ${order.final_sale ? "yes" : "no"}, warranty ${order.warranty_months} months.`,
    };
  },
  apply_policy: ({ rule, allowed, note }) => {
    const row = $(`.policy-row[data-rule="${Number(rule)}"]`);
    if (!row) return { ok: false, message: "Unknown rule number — rules are 1 to 4." };
    row.classList.remove("hit", "allowed", "blocked");
    void row.offsetWidth;
    row.classList.add("hit", allowed ? "allowed" : "blocked");
    $(".p-flag", row).textContent = `${allowed ? "✓" : "✗"} ${String(note || "").slice(0, 48)}`;
    $("#policy-state").textContent = "reasoning live";
    return { ok: true, message: `Rule ${rule} marked ${allowed ? "allowed" : "blocked"} on screen.` };
  },
  update_case: (args) => {
    const allowed = ["order_number", "email", "phone", "issue", "resolution"];
    const written = [];
    for (const f of allowed) {
      if (args[f] != null && String(args[f]).trim() !== "") {
        caseData[f] = String(args[f]).trim();
        setKV("case", f, caseData[f]);
        written.push(f);
      }
    }
    if (!written.length) return { ok: false, message: "No recognized fields. Pass order_number, email, phone, issue, or resolution." };
    return { ok: true, updated: written, message: `Noted ${written.join(", ")}.` };
  },
  submit_case: () => {
    const hasContact = caseData.order_number || (caseData.email && caseData.phone) || caseData.email;
    if (!caseData.issue || !caseData.resolution || !hasContact) {
      return { ok: false, message: "Missing details — need the issue, the desired resolution, and an order number or contact info before filing." };
    }
    const ticket = `RF-${Math.floor(1000 + Math.random() * 9000)}`;
    $("#case-state").textContent = "escalated";
    const stamp = $("#case-stamp");
    stamp.textContent = `Ticket ${ticket} filed — handed to the human team. Follow-up within 1 business day.`;
    stamp.classList.add("show");
    return { ok: true, ticket, message: `Case filed as ticket ${ticket}. Read it back digit by digit.` };
  },
};

/* ------------------------------------------------------------ copilot demo */
const COLORS = {
  teal: "#0d9488", blue: "#2563eb", "royal blue": "#1d4ed8", navy: "#1e3a8a", sky: "#0ea5e9",
  crimson: "#dc2626", red: "#dc2626", orange: "#ea580c", amber: "#d97706", gold: "#ca8a04",
  green: "#16a34a", emerald: "#059669", lime: "#65a30d", purple: "#7c3aed", violet: "#8b5cf6",
  magenta: "#c026d3", pink: "#db2777", rose: "#e11d48", brown: "#92400e", slate: "#475569",
  black: "#0a0a0a", white: "#fafafa",
};

function logAction(name, detail) {
  const log = $("#copilot-log");
  if (log.dataset.used !== "1") { log.innerHTML = ""; log.dataset.used = "1"; }
  const row = document.createElement("div");
  const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  row.innerHTML = `${t} · <b>${name}</b> ${detail}`;
  log.prepend(row);
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode === "dark" ? "dark" : "";
  if (mode !== "dark") delete document.documentElement.dataset.theme;
  $("#deck-theme").textContent = mode;
}

// Resolve any CSS color to rgb so we can pick readable text on accent surfaces.
function contrastFor(color) {
  const probe = document.createElement("span");
  probe.style.color = color;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0];
  probe.remove();
  const [r, g, b] = rgb;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 150 ? "#0a0a0a" : "#fafafa";
}

function applyAccent(value, label) {
  const root = document.documentElement;
  if (!value) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-contrast");
  } else {
    root.style.setProperty("--accent", value);
    root.style.setProperty("--accent-contrast", contrastFor(value));
  }
  $("#deck-accent").textContent = label;
  const splash = $("#accent-splash");
  if (splash && value) {
    splash.classList.remove("go");
    void splash.offsetWidth; // restart the animation
    splash.classList.add("go");
  }
}

/* Section guide — the copilot's tour mechanic. Scrolls to a section and pins
   an explainer card at its top: what the demo shows + how to try it. */
const GUIDES = {
  scheduling: {
    title: "Scheduling agent — Maya",
    blurb: "Books, moves, and cancels appointments on the live week calendar. Every change lands on screen the moment she makes it.",
    how: "Press Start demo in this section (that ends the copilot call), then ask for a slot.",
  },
  support: {
    title: "Support agent — policy reasoning",
    blurb: "Works strictly from the on-screen house policy: when a rule blocks your request it lights up red, and the agent offers the allowed path instead of a bare no.",
    how: "Press Start demo here and ask for a refund on AA-7391 — it's a final-sale trap.",
  },
  copilot: {
    title: "Page copilot",
    blurb: "Edmund drives this page by voice — theme, colors, navigation, banners — the same mechanism that voice-drives an e-commerce store or enterprise console.",
    how: "Just ask it to change or show something.",
  },
  intake: {
    title: "Lead-intake agent — Sabrina",
    blurb: "Interviews you about a project and fills the intake form field by field — voice in, structured data out.",
    how: "Press Start demo here and answer her questions.",
  },
  outbound: {
    title: "Outbound concierge",
    blurb: "Dials your real phone within seconds and holds a live conversation. Calls hard-stop at five minutes.",
    how: "Type a US number (+1 …) and press Call me.",
  },
  voices: {
    title: "Voice gallery",
    blurb: "The voice catalog behind every agent on this page — each line speaks with a different one.",
    how: "Press play on any card to hear a preview.",
  },
  languages: {
    title: "Languages — live agent handoff",
    blurb: "Start in English, ask for Spanish or Hindi, and a different agent with a native-fit voice takes over the same call.",
    how: "Press Start demo here (that ends the copilot call), then say 'Español, por favor'.",
  },
  memory: {
    title: "Memory agent — Imogen",
    blurb: "Remembers who you are between calls — hang up, call back, and she picks up where you left off.",
    how: "Press Start demo here, tell her about yourself, end the call, then call again.",
  },
  dualcontrol: {
    title: "Dual control — Hugh",
    blurb: "Your phone says No Service. Hugh flips roaming on the carrier CRM himself — but your phone's switches only you can touch, so he guides your hands.",
    how: "Press Start demo here, say you just landed abroad, and click the phone switches only when he asks.",
  },
  knowledge: {
    title: "Knowledge agent — Rhys",
    blurb: "Grounded in a five-document product library — quotes documented specs and refuses to invent anything.",
    how: "Press Start demo here and ask about warranty, specs, or troubleshooting.",
  },
};

function showSectionGuide(id) {
  const guide = GUIDES[id];
  const sec = document.getElementById(id);
  if (!guide || !sec) return null;
  $$(".guide-card").forEach((el) => el.remove());
  const phrases = $$(`#${id} .say span`).map((el) => el.textContent);
  const card = document.createElement("div");
  card.className = "guide-card";
  card.innerHTML = `
    <div class="guide-head">
      <span class="mono">Guide</span>
      <strong>${guide.title}</strong>
      <button class="close" aria-label="Dismiss">✕</button>
    </div>
    <p>${guide.blurb}</p>
    <p><b>How to try it:</b> ${guide.how}</p>
    <div class="guide-row"></div>`;
  const row = $(".guide-row", card);
  for (const p of phrases) {
    const chip = document.createElement("span");
    chip.className = "phrase";
    chip.textContent = p;
    row.appendChild(chip);
  }
  $("button.close", card).addEventListener("click", () => card.remove());
  $(".section-inner", sec).prepend(card);
  setTimeout(() => card.remove(), 45000);
  return { ...guide, try_saying: phrases };
}

const copilotTools = {
  set_theme: ({ mode }) => {
    const m = mode === "dark" ? "dark" : "light";
    applyTheme(m);
    logAction("set_theme", m);
    return { ok: true, message: `Switched to ${m} mode.` };
  },
  set_accent_color: ({ color }) => {
    const raw = String(color || "").trim().toLowerCase();
    const hex = COLORS[raw] || (CSS.supports("color", raw) ? raw : null);
    if (!hex) return { ok: false, message: `I don't know the color "${color}". Try a common name or a hex code.` };
    applyAccent(hex, raw);
    logAction("set_accent_color", raw);
    return { ok: true, message: `Accent is now ${raw}.` };
  },
  go_to_section: ({ section }) => {
    const id = String(section || "").toLowerCase();
    if (!flashSection(id)) return { ok: false, message: `Unknown section "${section}". Sections: scheduling, support, copilot, intake, outbound, voices, languages, memory, knowledge, dualcontrol.` };
    const guide = showSectionGuide(id);
    logAction("go_to_section", id);
    return {
      ok: true,
      section: id,
      what_it_shows: guide?.blurb,
      how_to_try: guide?.how,
      try_saying: guide?.try_saying,
      message: `Now showing the ${id} section with its on-screen guide. Briefly tell the visitor what it does and how to try it.`,
    };
  },
  show_toast: ({ message }) => {
    toast(message);
    logAction("show_toast", `"${String(message).slice(0, 40)}"`);
    return { ok: true, message: "Shown." };
  },
  reset_page: () => {
    applyTheme("light");
    applyAccent("", "default");
    $$(".guide-card").forEach((el) => el.remove());
    logAction("reset_page", "");
    return { ok: true, message: "Back to the default look." };
  },
};

/* ------------------------------------------------------------- intake demo */
const leadData = {};
const leadTools = {
  fill_lead: (args) => {
    const allowed = ["name", "company", "email", "use_case", "team_size", "timeline"];
    const written = [];
    for (const f of allowed) {
      if (args[f] != null && String(args[f]).trim() !== "") {
        leadData[f] = String(args[f]).trim();
        setKV("lead", f, leadData[f]);
        written.push(f);
      }
    }
    const missing = allowed.filter((f) => !leadData[f]);
    if (!written.length) return { ok: false, message: "No recognized fields." };
    return { ok: true, updated: written, still_missing: missing, message: `Noted. Still missing: ${missing.join(", ") || "nothing"}.` };
  },
  submit_lead: () => {
    if (!leadData.name || !leadData.email) return { ok: false, message: "Need at least a name and email before submitting." };
    const ref = `SQ-${Math.floor(1000 + Math.random() * 9000)}`;
    $("#lead-state").textContent = "submitted";
    const stamp = $("#lead-stamp");
    stamp.textContent = `Submitted as ${ref}. The team follows up within one business day.`;
    stamp.classList.add("show");
    return { ok: true, reference: ref, message: `Submitted — reference ${ref}.` };
  },
};

/* ---------------------------------------------------------- languages demo */
const LANG_VOICE = { english: "Harper", spanish: "Nuria", hindi: "Aaliyah" };

function setLangStage(stage) {
  $$(".lang-card").forEach((c) => c.classList.toggle("active", c.dataset.stage === stage));
  $("#lang-state").textContent = stage ? `live: ${stage}` : "waiting";
  const chip = $('[data-voice="languages"]');
  if (chip) chip.textContent = stage ? `Voice · ${LANG_VOICE[stage]}` : `Voice · ${(CFG.voices || {}).languages || ""}`;
}

const languagesTools = {
  set_stage: ({ stage }) => {
    const id = ["english", "spanish", "hindi"].includes(String(stage)) ? String(stage) : null;
    if (!id) return { ok: false, message: "Unknown stage." };
    setLangStage(id);
    return { ok: true, message: `The ${id} agent is now highlighted on screen.` };
  },
};

/* ------------------------------------------------------------- memory demo */
// Stable per-browser identity so Ivy's memories survive across calls.
function demoIdentity() {
  let id = localStorage.getItem("sq_demo_identity");
  if (!/^web_[a-z0-9]{6,40}$/.test(id || "")) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    id = "web_" + [...bytes].map((b) => (b % 36).toString(36)).join("");
    localStorage.setItem("sq_demo_identity", id);
  }
  return id;
}

let memTimers = [];
async function fetchMemories() {
  const res = await fetch(`/api/memories?identity=${demoIdentity()}`);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).facts || [];
}

async function loadMemories() {
  const list = $("#mem-list");
  try {
    const facts = await fetchMemories();
    if (!facts.length) {
      list.innerHTML = `<span class="empty">Nothing yet — memories show up here a little after your first call ends.</span>`;
      return;
    }
    list.innerHTML = facts.map((f) => `<div class="fact">${f.fact}</div>`).join("");
    $("#mem-state").textContent = `${facts.length} remembered`;
  } catch {
    // Display needs the server-side key; the agent's own memory is
    // unaffected — say so instead of looking broken.
    list.innerHTML = `<span class="empty">The memory display isn't connected on this deployment — the agent itself still remembers you. (Talk to her twice and see.)</span>`;
  }
}

// Ivy's opening line adapts per caller: the page checks the memory bank
// and fills the {{greeting}} variable before the call starts.
const NEW_CALLER_GREETING = "Who am I speaking with today?";
async function memoryGreeting() {
  try {
    const facts = await fetchMemories();
    if (!facts.length) return NEW_CALLER_GREETING;
    const named = facts.map((f) => f.fact.match(/named ([A-Z][\w-]+)/)).find(Boolean);
    return named ? `Welcome back, ${named[1]} — good to hear you again!` : "Welcome back — good to hear you again!";
  } catch {
    return NEW_CALLER_GREETING;
  }
}

function scheduleMemoryRefreshes() {
  memTimers.forEach(clearTimeout);
  // extraction runs after the call ends — poll a few times while it lands
  memTimers = [5000, 15000, 30000, 60000].map((ms) => setTimeout(loadMemories, ms));
}

/* --------------------------------------------------------- dual control */
// Two coupled worlds: the visitor's phone (their clicks only) and the
// carrier CRM (the agent's tools only). Signal needs all three switches.
const dcPhone = { airplane: true, roaming: false };
const dcCrm = { roaming: false };

function dcRender() {
  const sig = $("#phone-signal");
  if (!sig) return;
  const connected = !dcPhone.airplane && dcPhone.roaming && dcCrm.roaming;
  sig.textContent = dcPhone.airplane ? "✈ No Service" : connected ? "5G ▂▄▆█ full bars" : "No Signal";
  sig.className = "phone-signal " + (connected ? "ok" : "bad");
  $("#tg-airplane").setAttribute("aria-checked", String(dcPhone.airplane));
  $("#tg-roaming").setAttribute("aria-checked", String(dcPhone.roaming));
  const crmDd = $("#crm-roaming");
  crmDd.textContent = dcCrm.roaming ? "on ✓" : "off";
  crmDd.classList.toggle("set", dcCrm.roaming);
  const pc = $("#cond-phone"), cc = $("#cond-crm");
  pc.textContent = `${connected ? "✓" : "✗"} phone.signal == true`;
  pc.classList.toggle("met", connected);
  cc.textContent = `${dcCrm.roaming ? "✓" : "✗"} crm.line.roaming == true`;
  cc.classList.toggle("met", dcCrm.roaming);
}

$("#tg-airplane")?.addEventListener("click", () => { dcPhone.airplane = !dcPhone.airplane; dcRender(); });
$("#tg-roaming")?.addEventListener("click", () => { dcPhone.roaming = !dcPhone.roaming; dcRender(); });
dcRender();

function dcReset() {
  dcPhone.airplane = true;
  dcPhone.roaming = false;
  dcCrm.roaming = false;
  dcRender();
}

const dualcontrolTools = {
  get_line_details: () => ({
    ok: true,
    line: "L-1001",
    status: "active",
    plan: "Global Flex 5 GB",
    intl_roaming: dcCrm.roaming ? "on" : "off",
    message: `Line L-1001 is active on Global Flex; international roaming is ${dcCrm.roaming ? "ON" : "OFF"} on the network side. You cannot see the phone — ask the caller what it shows.`,
  }),
  enable_roaming: () => {
    dcCrm.roaming = true;
    dcRender();
    return { ok: true, message: "International roaming is now enabled on line L-1001. The caller still needs Airplane Mode off and Data Roaming on, on the phone itself." };
  },
};

/* --------------------------------------------------- widget call plumbing */
const TOOLSETS = {
  scheduling: schedulingTools,
  support: supportTools,
  copilot: copilotTools,
  intake: leadTools,
  languages: languagesTools,
  dualcontrol: dualcontrolTools,
  memory: {},
  knowledge: {},
};
let sdk = null;
let active = null; // { slot, handle }
// Bumped on every start/stop. An in-flight connect whose generation is stale
// (someone started another call or pressed End meanwhile) discards itself —
// this is what guarantees "only one agent at a time" even across the
// seconds-long connecting window.
let callGen = 0;

async function loadSDK() {
  if (!sdk) sdk = await import(`${CFG.apiBase}/v1/widget/agents.mjs`);
  return sdk;
}

function setStatus(slot, text, live) {
  $(`[data-status="${slot}"]`).textContent = text;
  $(`[data-dot="${slot}"]`).classList.toggle("live", !!live);
}

function resetSlotUI(slot) {
  setStatus(slot, "idle", false);
  $(`[data-start="${slot}"]`).hidden = false;
  $(`[data-stop="${slot}"]`).hidden = true;
}

function renderTranscript(slot, msgs) {
  const box = $(`[data-transcript="${slot}"]`);
  if (!msgs.length) return;
  box.classList.add("open");
  box.innerHTML = msgs
    .map((m) => `<div class="line ${m.role === "user" ? "user" : ""}"><span>${m.role === "user" ? "you" : "agent"}</span>${m.text}</div>`)
    .join("");
  box.scrollTop = box.scrollHeight;
}

async function stopCall() {
  callGen++;
  if (!active) return;
  const { slot, handle } = active;
  active = null;
  try { await handle.stop(); } catch { /* already closed */ }
  document.body.classList.remove("call-live");
  resetSlotUI(slot);
  if (slot === "memory") scheduleMemoryRefreshes();
  if (slot === "languages") setLangStage(null);
}

async function startCall(slot) {
  await stopCall();
  const gen = ++callGen;
  const agentId = CFG.agents[slot];
  if (!agentId) { toast("This demo agent isn't configured yet."); return; }
  if (slot === "support") {
    $$(".policy-row").forEach((r) => { r.classList.remove("hit", "allowed", "blocked"); $(".p-flag", r).textContent = ""; });
    $("#policy-state").textContent = "watching";
  }
  if (slot === "dualcontrol") dcReset();
  setStatus(slot, "connecting…", false);
  $(`[data-start="${slot}"]`).hidden = true;
  $(`[data-stop="${slot}"]`).hidden = false;
  try {
    const mod = await loadSDK();
    const handle = await mod.startAgent({
      agentId,
      apiBase: CFG.apiBase,
      // The memory demo needs a stable caller identity for Ivy to remember,
      // and gets a per-caller opening line via the {{greeting}} variable.
      ...(slot === "memory"
        ? { userIdentity: demoIdentity(), dynamicVariables: { greeting: await memoryGreeting() } }
        : {}),
      onStatus: (s) => {
        if (gen !== callGen) return; // stale call
        if (active && active.slot === slot) setStatus(slot, String(s), String(s) !== "idle");
        if (String(s) === "idle" && active && active.slot === slot) stopCall();
      },
      onError: (err) => {
        if (gen !== callGen) return;
        setStatus(slot, "error", false);
        toast(err instanceof Error ? err.message : String(err));
      },
      onTranscript: (msgs) => {
        if (gen !== callGen) return;
        const list = Array.isArray(msgs) ? msgs : [];
        renderTranscript(slot, list.map((m, i) => ({ id: m.id ?? i, role: m.role === "user" ? "user" : "agent", text: m.text ?? "" })));
      },
    });
    if (gen !== callGen) {
      // Another call started (or End was pressed) while we were connecting.
      try { await handle.stop(); } catch { /* ignore */ }
      if (!active || active.slot !== slot) resetSlotUI(slot);
      return;
    }
    for (const [name, fn] of Object.entries(TOOLSETS[slot])) {
      handle.registerTool(name, async (args) => fn(args || {}));
    }
    active = { slot, handle };
    await handle.setMicEnabled(true);
    if (gen === callGen) setStatus(slot, "listening", true);
    document.body.classList.add("call-live");
  } catch (err) {
    if (gen !== callGen) return;
    await stopCall(); // tear down a half-open session (e.g. mic failed after connect)
    resetSlotUI(slot);
    toast(err instanceof Error ? err.message : "Could not start the call — check mic permissions.");
  }
}

$$("[data-start]").forEach((btn) => btn.addEventListener("click", () => startCall(btn.dataset.start)));
$$("[data-stop]").forEach((btn) => btn.addEventListener("click", () => { stopCall(); resetSlotUI(btn.dataset.stop); }));
window.addEventListener("pagehide", () => { stopCall(); });

/* ----------------------------------------------------------- outbound demo */
const MAX_SECONDS_FALLBACK = 300;
let outbound = null; // { conversationId, maxSeconds, startedAt, pollTimer, tickTimer }

function fmt(secs) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function setOutState(text) { $("#out-state").textContent = text; }
function outError(msg) {
  const el = $("#out-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function clearOutboundTimers() {
  if (outbound?.pollTimer) clearInterval(outbound.pollTimer);
  if (outbound?.tickTimer) clearInterval(outbound.tickTimer);
}

const OUTBOUND_STORE_KEY = "sq_outbound_conv";

function finishOutbound(label) {
  clearOutboundTimers();
  outbound = null;
  localStorage.removeItem(OUTBOUND_STORE_KEY);
  setOutState(label);
  $("#call-me").disabled = false;
  $("#end-call").hidden = true;
  $("#countdown").textContent = fmt(MAX_SECONDS_FALLBACK);
}

async function endOutbound(reason) {
  if (!outbound) return;
  const id = outbound.conversationId;
  try {
    await fetch("/api/end-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: id }),
    });
  } catch { /* sweeper will catch it */ }
  finishOutbound(reason);
}

function beginCountdown(startMs) {
  if (!outbound || outbound.startedAt) return;
  outbound.startedAt = startMs || Date.now();
  setOutState("in call");
  outbound.tickTimer = setInterval(() => {
    if (!outbound) return;
    const left = outbound.maxSeconds - (Date.now() - outbound.startedAt) / 1000;
    $("#countdown").textContent = fmt(left);
    if (left <= 0) endOutbound("auto-disconnected at 5:00");
  }, 500);
}

async function pollStatus() {
  if (!outbound) return;
  try {
    const res = await fetch(`/api/call-status?id=${outbound.conversationId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === "active") beginCountdown(data.started_at ? Date.parse(data.started_at) : Date.now());
    if (data.status === "completed" || data.status === "failed") {
      finishOutbound(data.status === "completed" ? "call ended" : "call failed");
    }
  } catch { /* transient */ }
}

$("#call-me").addEventListener("click", async () => {
  await stopCall(); // one agent at a time — the phone call counts too
  outError("");
  const phone = $("#phone").value;
  $("#call-me").disabled = true;
  setOutState("dialing…");
  try {
    const res = await fetch("/api/outbound-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not place the call.");
    outbound = { conversationId: data.conversation_id, maxSeconds: data.max_seconds || MAX_SECONDS_FALLBACK, startedAt: null };
    localStorage.setItem(OUTBOUND_STORE_KEY, JSON.stringify({ id: outbound.conversationId, maxSeconds: outbound.maxSeconds }));
    $("#end-call").hidden = false;
    $("#countdown").textContent = fmt(outbound.maxSeconds);
    outbound.pollTimer = setInterval(pollStatus, 4000);
  } catch (err) {
    outError(err.message);
    finishOutbound("ready");
  }
});

$("#end-call").addEventListener("click", () => endOutbound("call ended"));

// A refresh mid-call used to orphan the countdown (the cron sweeper still
// capped the call, but the page lost track). Reconnect to a stored live call.
async function restoreOutbound() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(OUTBOUND_STORE_KEY) || "null"); } catch { stored = null; }
  if (!stored?.id) return;
  try {
    const res = await fetch(`/api/call-status?id=${stored.id}`);
    if (!res.ok) { localStorage.removeItem(OUTBOUND_STORE_KEY); return; }
    const data = await res.json();
    if (data.status === "completed" || data.status === "failed") {
      localStorage.removeItem(OUTBOUND_STORE_KEY);
      return;
    }
    outbound = { conversationId: stored.id, maxSeconds: stored.maxSeconds || MAX_SECONDS_FALLBACK, startedAt: null };
    $("#call-me").disabled = true;
    $("#end-call").hidden = false;
    setOutState(data.status === "active" ? "in call" : "dialing…");
    if (data.status === "active") beginCountdown(data.started_at ? Date.parse(data.started_at) : Date.now());
    outbound.pollTimer = setInterval(pollStatus, 4000);
  } catch { /* status endpoint unreachable — the cron sweeper still caps the call */ }
}
restoreOutbound();

/* -------------------------------------------------- new-line page wiring */
// Voice chips on every call panel ("VOICE · KARA").
for (const [slot, label] of Object.entries(CFG.voices || {})) {
  const chip = $(`[data-voice="${slot}"]`);
  if (chip) chip.textContent = `Voice · ${label}`;
}

// Which line uses which voice — badges in the gallery.
const LINE_OF_VOICE = {};
const SLOT_LINE = { scheduling: "01", support: "02", copilot: "03", intake: "04", outbound: "05", memory: "08", knowledge: "09", dualcontrol: "10" };
for (const [slot, label] of Object.entries(CFG.voices || {})) {
  LINE_OF_VOICE[label.toLowerCase()] = SLOT_LINE[slot];
}

// Voice gallery: one shared player; click toggles play/pause.
let voicePlayer = null;
let playingCard = null;

async function loadVoiceGallery() {
  const grid = $("#voice-grid");
  if (!grid) return;
  try {
    const voices = CFG.voiceCatalog || [];
    if (!voices.length) throw new Error();
    grid.innerHTML = "";
    $("#voice-count").textContent = `${voices.length} voices`;
    for (const v of voices) {
      const card = document.createElement("div");
      card.className = "voice-card";
      const line = LINE_OF_VOICE[v.name.toLowerCase()];
      card.innerHTML = `
        <button class="play" aria-label="Play ${v.name} preview">▶</button>
        <div class="v-meta">
          <div class="v-name">${v.name}${line ? ` <span class="used mono">Line ${line}</span>` : ""}</div>
          <div class="v-sub">${[v.locale, v.gender, v.style].filter(Boolean).join(" · ")}</div>
        </div>`;
      const btn = $("button.play", card);
      btn.addEventListener("click", () => {
        if (playingCard === card) {
          voicePlayer.pause();
          return;
        }
        if (!voicePlayer) {
          voicePlayer = new Audio();
          voicePlayer.addEventListener("pause", () => {
            if (playingCard) {
              playingCard.classList.remove("playing");
              $("button.play", playingCard).textContent = "▶";
              playingCard = null;
            }
          });
        }
        if (playingCard) {
          playingCard.classList.remove("playing");
          $("button.play", playingCard).textContent = "▶";
        }
        voicePlayer.src = v.preview;
        voicePlayer.play().catch(() => toast("Preview couldn't play — try again."));
        playingCard = card;
        card.classList.add("playing");
        btn.textContent = "❚❚";
      });
      grid.appendChild(card);
    }
  } catch {
    grid.innerHTML = `<span class="out-note">Voice previews aren't available right now.</span>`;
  }
}
loadVoiceGallery();

// Knowledge library card contents (names come from the generated config).
const kbList = $("#kb-list");
if (kbList) {
  kbList.innerHTML = (CFG.kbDocs || []).map((n) => `<div class="kb-doc">${n}</div>`).join("");
}

// Memory bank buttons + initial load.
$("#mem-refresh")?.addEventListener("click", loadMemories);
$("#mem-forget")?.addEventListener("click", async () => {
  const btn = $("#mem-forget");
  btn.disabled = true;
  try {
    await fetch("/api/forget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: demoIdentity() }),
    });
    toast("Forgotten — Ivy starts fresh with you.");
    $("#mem-state").textContent = "this browser";
    await loadMemories();
  } finally {
    btn.disabled = false;
  }
});
loadMemories();

/* ------------------------------------------------------- page atmosphere */
// Hero waveform: 28 bars with a sine-shaped contour and staggered timing.
const wave = $("#hero-wave");
if (wave) {
  for (let i = 0; i < 28; i++) {
    const bar = document.createElement("i");
    const peak = 30 + Math.round(55 * Math.abs(Math.sin(i * 0.45)));
    bar.style.setProperty("--peak", `${peak}%`);
    bar.style.animationDelay = `${(i * 0.09).toFixed(2)}s`;
    wave.appendChild(bar);
  }
}

// Capability ticker: duplicate the strip once so the -50% loop is seamless.
const ticker = $("#ticker");
if (ticker) ticker.innerHTML += ticker.innerHTML;

// Scroll reveal — once per element; skipped entirely for reduced motion.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduceMotion || !("IntersectionObserver" in window)) {
  $$(".reveal").forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  $$(".reveal").forEach((el) => io.observe(el));
}

// Dev/verification hook (harmless in prod): lets tests fire tool handlers
// exactly as an agent tool-call would, no live call needed.
window.__showcase = { tools: TOOLSETS, showSectionGuide, flashSection, stopCall, restoreOutbound };
