import { NextResponse } from "next/server";

export const runtime = "nodejs";

// simba-3.2 serves from a curated voice allow-list:
// https://docs.speechify.ai/build/changelog/2026/7/8
const SIMBA_32_VOICES = [
  "beatrice_32",
  "dominic_32",
  "edmund_32",
  "geffen_32",
  "harper_32",
  "hugh_32",
  "imogen_32",
  "wyatt_32",
];

interface CatalogVoice {
  id: string;
  display_name?: string;
  gender?: string;
}

function fallback() {
  return NextResponse.json({
    voices: SIMBA_32_VOICES.map((id) => ({ id, display_name: id })),
  });
}

export async function GET() {
  const apiKey = process.env.SPEECHIFY_API_KEY;
  if (!apiKey) return fallback();

  try {
    const res = await fetch("https://api.speechify.ai/v1/voices", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return fallback();

    // GET /v1/voices returns an object envelope (2026-06-27+):
    // { voices: [...], next_cursor, has_more }
    const data = (await res.json()) as { voices?: CatalogVoice[] };
    const catalog = new Map((data.voices ?? []).map((v) => [v.id, v]));

    return NextResponse.json({
      voices: SIMBA_32_VOICES.map((id) => ({
        id,
        display_name: catalog.get(id)?.display_name ?? id,
        gender: catalog.get(id)?.gender ?? null,
      })),
    });
  } catch {
    return fallback();
  }
}
