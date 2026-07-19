#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { demos } = JSON.parse(readFileSync(join(root, "demos.json"), "utf8"));

// The README is a static artifact, so it needs a canonical origin baked in.
// Prefer Vercel's VERCEL_PROJECT_PRODUCTION_URL (always set at build, resolves
// to the shortest production custom domain — or the .vercel.app fallback until a
// custom domain is attached), so we never assume a domain that isn't live yet.
// DEMOS_HOSTED_ORIGIN overrides everything; the literal is only a last resort
// for local runs with no Vercel env.
function resolveHostedOrigin() {
  if (process.env.DEMOS_HOSTED_ORIGIN) return process.env.DEMOS_HOSTED_ORIGIN;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://demos.speechify.ai";
}
const HOSTED_ORIGIN = resolveHostedOrigin().replace(/\/+$/, "");
const liveUrl = (d) => `${HOSTED_ORIGIN}/${d.slug}`;

// Demo folders live under demos/<slug>; the public URL is still /<slug>. Keep
// the repo path (folder/source links) separate from the slug (URL path).
const repoPath = (d) => `demos/${d.slug}`;

function renderReadmeTable() {
  const rows = demos.map((d) => {
    const folder = `[\`${repoPath(d)}/\`](./${repoPath(d)})`;
    const live = d.hosted ? `[Open](${liveUrl(d)})` : "";
    return `| ${folder} | ${d.stack} | ${live} | ${d.blurb} |`;
  });
  return [
    "| Folder | Stack | Live | What it does |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const START = "<!-- DEMOS:START -->";
const END = "<!-- DEMOS:END -->";

function writeReadme() {
  const path = join(root, "README.md");
  const readme = readFileSync(path, "utf8");
  const table = renderReadmeTable();
  const block = `${START}\n${table}\n${END}`;
  const re = new RegExp(`${START}[\\s\\S]*${END}`);
  if (!re.test(readme)) {
    throw new Error(`README.md is missing the ${START} / ${END} markers`);
  }
  writeFileSync(path, readme.replace(re, block));
}

// Inline the manifest directly into index.html rather than a separate
// demos.generated.js. A standalone JS file is cached at the edge (max-age 14400)
// independently of the HTML, so a deploy can serve stale demo data for hours.
// Inlining ties the data to the (revalidated) HTML: always fresh, one fewer request.
const DATA_START = "/* DEMOS_DATA:START */";
const DATA_END = "/* DEMOS_DATA:END */";

const INDEX_PATH = join(root, "site", "public", "index.html");
const REPO_URL = "https://github.com/Speechify-AI/demos";

function esc(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function replaceMarker(html, start, end, inner) {
  const re = new RegExp(`${esc(start)}[\\s\\S]*${esc(end)}`);
  if (!re.test(html)) throw new Error(`index.html is missing the ${start} / ${end} markers`);
  return html.replace(re, `${start}\n${inner}\n${end}`);
}

function payloadFor(d) {
  return {
    slug: d.slug,
    repoPath: repoPath(d),
    title: d.title,
    stack: d.stack,
    hosted: Boolean(d.hosted),
    blurb: d.blurb,
  };
}

// The FAQ questions are mirrored from the visible <section class="faq"> so the
// FAQPage schema reflects on-page content (a Google requirement for eligibility).
const FAQ = [
  ["What are the Speechify demos?", "Open-source, self-contained example apps for the Speechify API — text-to-speech, voice cloning, SSML, and real-time voice agents. Each demo lives in its own folder, runs on its own, and links to its source. Hosted demos run live in the browser."],
  ["Are the demos free and open source?", "Yes. Every demo is MIT-licensed and published at github.com/Speechify-AI/demos. Clone a folder, add your Speechify API key, and run it."],
  ["What do I need to run a demo?", "A Speechify API key from platform.speechify.ai/api-keys, plus the runtime the demo uses (Node, Python, or Go). Each demo's README lists its exact prerequisites."],
  ["Which demos can I try without installing anything?", "Demos marked LIVE run hosted at demos.speechify.ai/<demo-name>. The rest are clone-and-run from the repo."],
];

function buildJsonLd() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${HOSTED_ORIGIN}/#org`,
      name: "Speechify AI",
      url: "https://speechify.ai",
      logo: `${HOSTED_ORIGIN}/apple-touch-icon.png`,
      sameAs: ["https://github.com/SpeechifyInc", "https://x.com/SpeechifyAI", "https://www.linkedin.com/company/speechifyinc/"],
    },
    {
      "@type": "WebSite",
      "@id": `${HOSTED_ORIGIN}/#website`,
      url: `${HOSTED_ORIGIN}/`,
      name: "Speechify Demos",
      description: "Open-source demos built on the Speechify API — text-to-speech, voice cloning, and real-time voice agents.",
      publisher: { "@id": `${HOSTED_ORIGIN}/#org` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "SpeechifyAI", item: "https://speechify.ai" },
        { "@type": "ListItem", position: 2, name: "Demos", item: `${HOSTED_ORIGIN}/` },
      ],
    },
    {
      "@type": "ItemList",
      name: "Speechify API demos",
      numberOfItems: demos.length,
      itemListElement: demos.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SoftwareApplication",
          name: d.title,
          description: d.blurb,
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any",
          url: d.hosted ? liveUrl(d) : `${REPO_URL}/tree/main/${repoPath(d)}`,
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

function writeSiteData() {
  let html = readFileSync(INDEX_PATH, "utf8");
  html = replaceMarker(html, DATA_START, DATA_END, `      window.__DEMOS__ = ${JSON.stringify(demos.map(payloadFor))};`);
  // The JSON-LD markers are HTML comments *outside* the <script>, so the whole
  // script tag is regenerated with pure JSON inside (a JS-comment marker inside
  // the script would make the ld+json invalid and unparseable by crawlers).
  html = replaceMarker(html, "<!-- JSONLD:START -->", "<!-- JSONLD:END -->", `    <script type="application/ld+json">${buildJsonLd()}</script>`);
  writeFileSync(INDEX_PATH, html);
}

function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${HOSTED_ORIGIN}/`, ...demos.filter((d) => d.hosted).map((d) => liveUrl(d))];
  const body = urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  writeFileSync(join(root, "site", "public", "sitemap.xml"), xml);
}

function writeLlms() {
  const hosted = demos.filter((d) => d.hosted);
  const summary = `# Speechify Demos\n\n> Open-source demos for the Speechify API (text-to-speech, voice cloning, SSML, real-time voice agents). ${demos.length} demos, ${hosted.length} hosted live at ${HOSTED_ORIGIN}. Source: ${REPO_URL} (MIT).`;
  const lines = demos.map((d) => {
    const url = d.hosted ? liveUrl(d) : `${REPO_URL}/tree/main/${repoPath(d)}`;
    return `- ${d.title} (${d.stack})${d.hosted ? " [hosted]" : ""}: ${d.blurb} — ${url}`;
  });
  const short = `${summary}\n\n## Demos\n\n${lines.join("\n")}\n`;
  const faq = FAQ.map(([q, a]) => `### ${q}\n${a}`).join("\n\n");
  const full = `${short}\n## FAQ\n\n${faq}\n\nGet an API key: https://platform.speechify.ai/api-keys\n`;
  writeFileSync(join(root, "site", "public", "llms.txt"), short);
  writeFileSync(join(root, "site", "public", "llms-full.txt"), full);
}

writeReadme();
writeSiteData();
writeSitemap();
writeLlms();
console.log(`generated README table + site data + JSON-LD + sitemap + llms.txt for ${demos.length} demos`);
