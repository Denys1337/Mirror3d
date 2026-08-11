import { NextResponse } from "next/server";
import { JTL_SHOP_ORIGIN } from "../../../../lib/jtlShop";

export const runtime = "nodejs";

/** HTML з JTL часто віддається лише з Basic + cookie (як /io) — без цього upstream дає 401. */
export const dynamic = "force-dynamic";

const JTL_COMBINED_CSS_URL =
  `${JTL_SHOP_ORIGIN}/asset/schreiber.css,plugin_css?v=1.0.3`;
const JTL_PRODUCT_PAGE_URL =
  `${JTL_SHOP_ORIGIN}/spiegel/p/badspiegel-frame-4s1-led`;

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
    return new URL(href, `${JTL_SHOP_ORIGIN}/`).toString();
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
      const abs = new URL(inner, `${JTL_SHOP_ORIGIN}/`).toString();
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

/** У повній сторінці (iframe) — як у браузера. */
const NO_HORIZONTAL_SCROLL_STYLE = `<style data-mirror3d-opt>html{overflow-x:hidden;max-width:100%;}body{max-width:100%!important;overflow-x:hidden!important;box-sizing:border-box;margin:0;}img,iframe,video,svg{max-width:100%!important;height:auto!important;}table{max-width:100%;display:block;overflow-x:auto;}pre{max-width:100%;overflow-x:auto;white-space:pre-wrap;word-break:break-word;}</style>`;

/**
 * У фрагменті HTML уставляється в div.jtl-option-html-inline — правила для html/body не працюють
 * і не повинні глобально перебивати Bootstrap у застосунку.
 */
const NO_HORIZONTAL_SCROLL_FRAGMENT_STYLE = `<style data-mirror3d-opt>.jtl-option-html-inline{overflow-x:hidden;max-width:100%;box-sizing:border-box;}.jtl-option-html-inline img,.jtl-option-html-inline iframe,.jtl-option-html-inline video,.jtl-option-html-inline svg{max-width:100%!important;height:auto!important;}.jtl-option-html-inline table{max-width:100%;display:block;overflow-x:auto;}.jtl-option-html-inline pre{max-width:100%;overflow-x:auto;white-space:pre-wrap;word-break:break-word;}</style>`;

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

/** Тільки для fragment=1 — усі селектори під .jtl-option-html-inline, щоб не ламати Bootstrap у всьому додатку. */
const ICON_FALLBACK_FRAGMENT_STYLE = `<style data-mirror3d-icon-fallback>
.jtl-option-html-inline .fa{display:inline-block;line-height:1;font-style:normal;}
.jtl-option-html-inline .fa-search::before{content:"🔍" !important;}
.jtl-option-html-inline .fa-info-circle::before{content:"ℹ";}
.jtl-option-html-inline .fa-file-pdf-o::before{content:"📄";}
.jtl-option-html-inline .fa-fw{display:inline-flex;align-items:center;justify-content:center;min-width:1.25em;text-align:center;}
.jtl-option-html-inline .pull-left{float:left;margin-right:.3em;}
</style>`;

function injectNoHorizontalScroll(html: string, fragment: boolean): string {
  if (/data-mirror3d-opt/.test(html)) return html;
  const tag = fragment
    ? NO_HORIZONTAL_SCROLL_FRAGMENT_STYLE
    : NO_HORIZONTAL_SCROLL_STYLE;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  }
  return `${tag}${html}`;
}

function injectGridFallback(html: string, fragment: boolean): string {
  if (fragment) {
    /* Bootstrap 5 уже в layout; старий fallback перебивав .row/.container глобально. */
    return html;
  }
  if (/data-mirror3d-grid-fallback/.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${GRID_FALLBACK_STYLE}`);
  }
  return `${GRID_FALLBACK_STYLE}${html}`;
}

function injectIconFallback(html: string, fragment: boolean): string {
  if (/data-mirror3d-icon-fallback/.test(html)) return html;
  const tag = fragment ? ICON_FALLBACK_FRAGMENT_STYLE : ICON_FALLBACK_STYLE;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  }
  return `${tag}${html}`;
}

function stripBaseTags(html: string): string {
  return html.replace(/<base\b[^>]*>/gi, "");
}

/** Без <base> у фрагменті відносні URL мають резолвитись відносно самого option_*.html на JTL. */
function needsAbsolutizeResourceUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (/^(https?:|data:|blob:|mailto:|tel:|about:|#)/i.test(t)) return false;
  if (/^javascript:/i.test(t)) return false;
  return true;
}

function toAbsoluteResourceUrl(url: string, documentUrl: string): string {
  try {
    return new URL(url, documentUrl).href;
  } catch {
    return url;
  }
}

function absolutizeSrcsetValue(val: string, documentUrl: string): string {
  return val
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      const spaceIdx = trimmed.search(/\s+/);
      const urlPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const rest = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx);
      if (!needsAbsolutizeResourceUrl(urlPart)) return trimmed;
      return `${toAbsoluteResourceUrl(urlPart, documentUrl)}${rest}`;
    })
    .join(", ");
}

/**
 * Фрагмент вставляється в Next-додаток: відносні src/href мають стати абсолютними на JTL.
 */
function absolutizeResourceUrlsInFragment(
  html: string,
  documentUrl: string
): string {
  let out = html.replace(
    /\b(srcset|data-srcset)=(["'])([^"']*)\2/gi,
    (_full, name: string, q: string, val: string) =>
      `${name}=${q}${absolutizeSrcsetValue(val, documentUrl)}${q}`
  );
  const attrRe =
    /\b(src|href|poster|data-src)=(["'])([^"']*)\2/gi;
  out = out.replace(attrRe, (full, name: string, q: string, val: string) => {
    if (!needsAbsolutizeResourceUrl(val)) return full;
    return `${name}=${q}${toAbsoluteResourceUrl(val, documentUrl)}${q}`;
  });
  return out;
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

  const upstreamUrl = `${JTL_SHOP_ORIGIN}/media/content/options/option_${raw}.html`;

  const cookie = readEnvTrim("JTL_COOKIE");

  const upstreamHeaders: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    Authorization: JTL_AUTHORIZATION,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Origin: JTL_SHOP_ORIGIN,
    Referer: `${JTL_SHOP_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) upstreamHeaders.Cookie = cookie;

  const cssHeaders: Record<string, string> = {
    Accept: "text/css,*/*;q=0.1",
    Authorization: JTL_AUTHORIZATION,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Referer: `${JTL_SHOP_ORIGIN}/`,
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
      fetchCss(`${JTL_SHOP_ORIGIN}/asset/schreiber.css,plugin_css`),
    fetchCss(`${JTL_SHOP_ORIGIN}/asset/schreiber.css`),
    fetchCss(`${JTL_SHOP_ORIGIN}/asset/plugin_css`),
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
  const withBase = asFragment ? html : injectBaseTag(html, JTL_SHOP_ORIGIN);
  html = injectGridFallback(
    injectIconFallback(
      injectNoHorizontalScroll(
        injectExternalCss(withBase, cssBundle),
        asFragment
      ),
      asFragment
    ),
    asFragment
  );

  if (asFragment) {
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const head = stripBaseTags(headMatch?.[1] ?? "");
    const body = bodyMatch?.[1] ?? html;
    const fragment = absolutizeResourceUrlsInFragment(
      `${head}\n${body}`,
      upstreamUrl
    );
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
