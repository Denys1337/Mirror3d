import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** HTML з JTL часто віддається лише з Basic + cookie (як /io) — без цього upstream дає 401. */
export const dynamic = "force-dynamic";

const JTL_ORIGIN = "https://test.schreiber-design.com";

const BASIC_USER = process.env.JTL_BASIC_USER;
const BASIC_PASS = process.env.JTL_BASIC_PASS;
const JTL_AUTHORIZATION =
  BASIC_USER && BASIC_PASS
    ? `Basic ${Buffer.from(`${BASIC_USER}:${BASIC_PASS}`, "utf8").toString(
        "base64"
      )}`
    : "Basic c2Rfb3NjOm82aFBpQ3pCRTZra1Eh";

function readEnvTrim(key: string): string | undefined {
  const raw = process.env[key];
  if (raw == null || raw === "") return undefined;
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function injectBaseTag(html: string, baseHref: string): string {
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head[^>]*>/i,
      (m) => `${m}<base href="${baseHref}/">`
    );
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html[^>]*>/i,
      (m) => `${m}<head><base href="${baseHref}/"></head>`
    );
  }
  return `<!DOCTYPE html><html><head><base href="${baseHref}/"></head><body>${html}</body></html>`;
}

/** Щоб контент JTL не роздував документ у iframe → горизонтальний скрол у попапі. */
const NO_HORIZONTAL_SCROLL_STYLE = `<style data-mirror3d-opt>html{overflow-x:hidden;max-width:100%;}body{max-width:100%!important;overflow-x:hidden!important;box-sizing:border-box;margin:0;}img,iframe,video,svg{max-width:100%!important;height:auto!important;}table{max-width:100%;display:block;overflow-x:auto;}pre{max-width:100%;overflow-x:auto;white-space:pre-wrap;word-break:break-word;}</style>`;

function injectNoHorizontalScroll(html: string): string {
  if (/data-mirror3d-opt/.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head[^>]*>/i,
      (m) => `${m}${NO_HORIZONTAL_SCROLL_STYLE}`
    );
  }
  return `${NO_HORIZONTAL_SCROLL_STYLE}${html}`;
}

export async function GET(
  _req: Request,
  { params }: { params: { gruppe: string } }
) {
  const raw = params.gruppe?.trim() ?? "";
  if (!/^\d+$/.test(raw)) {
    return NextResponse.json({ error: "Invalid gruppe" }, { status: 400 });
  }

  const upstreamUrl = `${JTL_ORIGIN}/media/content/options/option_${raw}.html`;

  const cookie = readEnvTrim("JTL_COOKIE");

  const upstreamHeaders: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    Authorization: JTL_AUTHORIZATION,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Origin: JTL_ORIGIN,
    Referer: `${JTL_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) upstreamHeaders.Cookie = cookie;

  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const status = res.status;
    const errLabel =
      status === 401 || status === 403
        ? "Upstream unauthorized — перевір JTL_BASIC_* та JTL_COOKIE в .env"
        : status === 404
          ? "Сторінку option_…html не знайдено"
          : "Помилка відповіді JTL";
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Info</title></head><body style="font-family:sans-serif;padding:16px"><p>${errLabel}</p><p>HTTP ${status}</p></body></html>`,
      {
        status: status === 404 ? 404 : status === 401 || status === 403 ? status : 502,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "frame-ancestors 'self'",
        },
      }
    );
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct || "application/octet-stream",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  }

  let html = await res.text();
  html = injectNoHorizontalScroll(injectBaseTag(html, JTL_ORIGIN));

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
