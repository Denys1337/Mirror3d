import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** HTML з JTL часто віддається лише з Basic + cookie (як /io) — без цього upstream дає 401. */
export const dynamic = "force-dynamic";

const JTL_ORIGIN = "https://test.schreiber-design.com";
const JTL_COMBINED_CSS_URL =
  `${JTL_ORIGIN}/asset/schreiber.css,plugin_css?v=1.0.3`;
const JTL_PRODUCT_PAGE_URL =
  `${JTL_ORIGIN}/spiegel/p/badspiegel-frame-4s1-led`;

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

function injectExternalCss(html: string, cssBundle: string): string {
  if (/data-mirror3d-jtl-css-inline/.test(html)) return html;
  if (!cssBundle.trim()) return html;
  const styleTag = `<style data-mirror3d-jtl-css-inline>${cssBundle}</style>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${styleTag}`);
  }
  return `${styleTag}${html}`;
}

function absolutizeCssUrl(href: string): string {
  try {
    return new URL(href, `${JTL_ORIGIN}/`).toString();
  } catch {
    return href;
  }
}

function extractStylesheetLinks(pageHtml: string): string[] {
  const out = new Set<string>();
  const re = /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  const matches = pageHtml.match(re) ?? [];
  for (const tag of matches) {
    const m = tag.match(hrefRe);
    const href = m?.[1]?.trim();
    if (!href) continue;
    if (href.startsWith("data:")) continue;
    out.add(absolutizeCssUrl(href));
  }
  return Array.from(out);
}

function rewriteCssUrlsToAbsolute(css: string): string {
  return css.replace(/url\(([^)]+)\)/gi, (full, rawInner) => {
    const inner = String(rawInner).trim().replace(/^['"]|['"]$/g, "");
    if (!inner) return full;
    if (
      /^data:/i.test(inner) ||
      /^blob:/i.test(inner) ||
      /^https?:\/\//i.test(inner)
    ) {
      return `url("${inner}")`;
    }
    if (inner.startsWith("//")) {
      return `url("https:${inner}")`;
    }
    try {
      const abs = new URL(inner, `${JTL_ORIGIN}/`).toString();
      return `url("${abs}")`;
    } catch {
      return full;
    }
  });
}

function stripBlockingMetaPolicies(html: string): string {
  return html
    .replace(
      /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ""
    )
    .replace(
      /<meta[^>]+http-equiv=["']X-Content-Security-Policy["'][^>]*>/gi,
      ""
    );
}

/** Щоб контент JTL не роздував документ у iframe → горизонтальний скрол у попапі. */
const NO_HORIZONTAL_SCROLL_STYLE = `<style data-mirror3d-opt>html{overflow-x:hidden;max-width:100%;}body{max-width:100%!important;overflow-x:hidden!important;box-sizing:border-box;margin:0;}img,iframe,video,svg{max-width:100%!important;height:auto!important;}table{max-width:100%;display:block;overflow-x:auto;}pre{max-width:100%;overflow-x:auto;white-space:pre-wrap;word-break:break-word;}</style>`;

const GRID_FALLBACK_STYLE = `<style data-mirror3d-grid-fallback>
*,*::before,*::after{box-sizing:border-box;}
.container,.container-fluid{width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto;}
.row{display:flex;flex-wrap:wrap;margin-right:-15px;margin-left:-15px;}
[class*=" col-"],[class^="col-"]{position:relative;width:100%;padding-right:15px;padding-left:15px;}
.col-12{flex:0 0 100%;max-width:100%;}
.col-3{flex:0 0 25%;max-width:25%;}
.col-9{flex:0 0 75%;max-width:75%;}
@media (min-width:576px){.col-sm-12{flex:0 0 100%;max-width:100%;}.col-sm-9{flex:0 0 75%;max-width:75%;}.col-sm-3{flex:0 0 25%;max-width:25%;}}
@media (min-width:768px){.col-md-12{flex:0 0 100%;max-width:100%;}.col-md-9{flex:0 0 75%;max-width:75%;}.col-md-3{flex:0 0 25%;max-width:25%;}}
@media (min-width:992px){.col-lg-12{flex:0 0 100%;max-width:100%;}.col-lg-9{flex:0 0 75%;max-width:75%;}.col-lg-3{flex:0 0 25%;max-width:25%;}}
</style>`;

const ICON_FALLBACK_STYLE = `<style data-mirror3d-icon-fallback>
.fa{display:inline-block;line-height:1;font-style:normal;}
.fa-search::before{content:"🔍" !important;}
.fa-info-circle::before{content:"ℹ";}
.fa-file-pdf-o::before{content:"📄";}
.fa-fw{display:inline-flex;align-items:center;justify-content:center;min-width:1.25em;text-align:center;}
.pull-left{float:left;margin-right:.3em;}
</style>`;

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

function injectGridFallback(html: string): string {
  if (/data-mirror3d-grid-fallback/.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${GRID_FALLBACK_STYLE}`);
  }
  return `${GRID_FALLBACK_STYLE}${html}`;
}

function injectIconFallback(html: string): string {
  if (/data-mirror3d-icon-fallback/.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${ICON_FALLBACK_STYLE}`);
  }
  return `${ICON_FALLBACK_STYLE}${html}`;
}

export async function GET(
  req: Request,
  { params }: { params: { gruppe: string } }
) {
  const raw = params.gruppe?.trim() ?? "";
  const url = new URL(req.url);
  const asFragment = url.searchParams.get("fragment") === "1";
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

  const cssHeaders: Record<string, string> = {
    Accept: "text/css,*/*;q=0.1",
    Authorization: JTL_AUTHORIZATION,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Referer: `${JTL_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) cssHeaders.Cookie = cookie;

  const fetchCss = async (url: string): Promise<string> => {
    try {
      const cssRes = await fetch(url, {
        headers: cssHeaders,
        cache: "no-store",
      });
      if (!cssRes.ok) return "";
      return await cssRes.text();
    } catch {
      return "";
    }
  };

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

  let html = stripBlockingMetaPolicies(await res.text());
  const [combinedCssVersioned, combinedCss, schreiberCss, pluginCss] =
    await Promise.all([
      fetchCss(JTL_COMBINED_CSS_URL),
      fetchCss(`${JTL_ORIGIN}/asset/schreiber.css,plugin_css`),
    fetchCss(`${JTL_ORIGIN}/asset/schreiber.css`),
    fetchCss(`${JTL_ORIGIN}/asset/plugin_css`),
    ]);
  const productPageHtml = await (async () => {
    try {
      const pageRes = await fetch(JTL_PRODUCT_PAGE_URL, {
        headers: upstreamHeaders,
        cache: "no-store",
      });
      if (!pageRes.ok) return "";
      return await pageRes.text();
    } catch {
      return "";
    }
  })();
  const productCssLinks = extractStylesheetLinks(productPageHtml);
  const productCssTexts = await Promise.all(productCssLinks.map(fetchCss));
  const rawCssBundle = [
    combinedCssVersioned,
    combinedCss,
    schreiberCss,
    pluginCss,
    ...productCssTexts,
  ]
    .filter((x) => x && x.trim().length > 0)
    .join("\n");
  const cssBundle = rewriteCssUrlsToAbsolute(rawCssBundle);
  html = injectGridFallback(
    injectIconFallback(
      injectNoHorizontalScroll(
        injectExternalCss(injectBaseTag(html, JTL_ORIGIN), cssBundle)
      )
    )
  );

  if (asFragment) {
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const head = headMatch?.[1] ?? "";
    const body = bodyMatch?.[1] ?? html;
    const fragment = `${head}\n${body}`;
    return new NextResponse(fragment, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
