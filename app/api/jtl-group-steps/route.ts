import { NextResponse } from "next/server";
import { JTL_SHOP_ORIGIN } from "../../../lib/jtlShop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GK_JSON_URL = `${JTL_SHOP_ORIGIN}/gk_json.php`;

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

function normalizeStepArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET() {
  const cookie = readEnvTrim("JTL_COOKIE");
  const headers: Record<string, string> = {
    Accept: "application/json,text/plain,*/*",
    Authorization: AUTH_HEADER,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Origin: JTL_SHOP_ORIGIN,
    Referer: `${JTL_SHOP_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;

  let res: Response;
  try {
    res = await fetch(GK_JSON_URL, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch gk_json" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", status: res.status },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid upstream JSON" }, { status: 502 });
  }

  const src = (parsed ?? {}) as Record<string, unknown>;
  // Step 1 intentionally ignored by client logic.
  const out = {
    "2": normalizeStepArray(src["2"]),
    "3": normalizeStepArray(src["3"]),
    "4": normalizeStepArray(src["4"]),
  };

  return NextResponse.json(out, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

