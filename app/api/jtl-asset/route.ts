import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JTL_ORIGIN = "https://test.schreiber-design.com";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("url")?.trim() ?? "";
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw, `${JTL_ORIGIN}/`);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.origin !== JTL_ORIGIN) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const cookie = readEnvTrim("JTL_COOKIE");
  const headers: Record<string, string> = {
    Accept: "image/*,*/*;q=0.8",
    Authorization: AUTH_HEADER,
    Referer: `${JTL_ORIGIN}/`,
    Origin: JTL_ORIGIN,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { headers, cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream asset" },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream asset error", status: upstream.status },
      { status: 502 }
    );
  }

  const buf = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
}

