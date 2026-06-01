import { NextResponse } from "next/server";
import type { GkArticleRule, GkGruppeMap } from "../../../lib/gkJson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GK_JSON_URL = "https://test.schreiber-design.com/gk_json.php";

const BASIC_USER = process.env.JTL_BASIC_USER;
const BASIC_PASS = process.env.JTL_BASIC_PASS;
const AUTH_HEADER =
  BASIC_USER && BASIC_PASS
    ? `Basic ${Buffer.from(`${BASIC_USER}:${BASIC_PASS}`, "utf8").toString(
        "base64"
      )}`
    : "Basic c2Rfb3NjOm82aFBpQ3pCRTZra1Eh";

function readEnvTrim(key: string): string | undefined {
  const raw = process.env[key];
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

function upstreamHeaders(): Record<string, string> {
  const cookie = readEnvTrim("JTL_COOKIE");
  const headers: Record<string, string> = {
    Accept: "application/json,text/plain,*/*",
    Authorization: AUTH_HEADER,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Origin: "https://test.schreiber-design.com",
    Referer: "https://test.schreiber-design.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

async function fetchGkJson(query: string): Promise<unknown> {
  const url = query ? `${GK_JSON_URL}?${query}` : GK_JSON_URL;
  const res = await fetch(url, { headers: upstreamHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`gk_json ${query || "base"} failed: ${res.status}`);
  }
  return res.json();
}

function normalizeStepArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

function parseArticleRules(v: unknown): GkArticleRule[] {
  if (!Array.isArray(v)) return [];
  const out: GkArticleRule[] = [];
  for (const row of v) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const text = typeof o.text === "string" ? o.text : "";
    if (!name || !text) continue;
    const artikel2short = Array.isArray(o.artikel2short)
      ? o.artikel2short.filter((x): x is string => typeof x === "string")
      : [];
    out.push({
      name,
      artikel2short,
      fehler: String(o.fehler ?? "0"),
      operant: o.operant != null ? String(o.operant) : undefined,
      text,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gruppe = (url.searchParams.get("gruppe") || "1").trim();
  const article = (url.searchParams.get("article") || "1").trim();

  try {
    const [stepsRaw, gruppeRaw, articleRaw] = await Promise.all([
      fetchGkJson(""),
      fetchGkJson(`gruppe=${encodeURIComponent(gruppe)}`),
      fetchGkJson(`article=${encodeURIComponent(article)}`),
    ]);

    const stepsSrc = (stepsRaw ?? {}) as Record<string, unknown>;
    const steps = {
      "2": normalizeStepArray(stepsSrc["2"]),
      "3": normalizeStepArray(stepsSrc["3"]),
      "4": normalizeStepArray(stepsSrc["4"]),
    };

    return NextResponse.json({
      steps,
      gruppe: (gruppeRaw ?? {}) as GkGruppeMap,
      article: parseArticleRules(articleRaw),
    });
  } catch (e) {
    console.error("jtl-gk-json", e);
    return NextResponse.json(
      { error: "Failed to fetch gk_json bundle" },
      { status: 502 }
    );
  }
}
