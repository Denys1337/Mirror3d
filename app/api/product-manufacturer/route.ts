import { NextResponse } from "next/server";
import { jtlFetch } from "../../../lib/jtlFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JTL_ORIGIN = "https://test.schreiber-design.com";

function stripHtmlTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractManufacturer(html: string): string | null {
  const byLabel = html.match(
    /(?:Hersteller|Manufacturer)\s*:?\s*(?:<\/[^>]+>\s*)?(?:<a[^>]*>)?([^<\n\r]+)(?:<\/a>)?/i
  );
  if (byLabel?.[1]) {
    const v = stripHtmlTags(byLabel[1]);
    if (v) return v;
  }

  const byTableRow = html.match(
    /<tr[^>]*>[\s\S]*?<t[hd][^>]*>\s*Hersteller\s*<\/t[hd]>[\s\S]*?<t[hd][^>]*>([\s\S]*?)<\/t[hd]>[\s\S]*?<\/tr>/i
  );
  if (byTableRow?.[1]) {
    const v = stripHtmlTags(byTableRow[1]);
    if (v) return v;
  }

  const byMeta = html.match(
    /<meta[^>]+(?:itemprop|name)=["']brand["'][^>]+content=["']([^"']+)["']/i
  );
  if (byMeta?.[1]) {
    const v = stripHtmlTags(byMeta[1]);
    if (v) return v;
  }

  const jsonLdRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch: RegExpExecArray | null;
  while ((jsonLdMatch = jsonLdRe.exec(html)) !== null) {
    const raw = jsonLdMatch[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const pickBrand = (v: unknown): string | null => {
        if (!v || typeof v !== "object") return null;
        if (Array.isArray(v)) {
          for (const item of v) {
            const out = pickBrand(item);
            if (out) return out;
          }
          return null;
        }
        const obj = v as Record<string, unknown>;
        const brand = obj.brand;
        if (typeof brand === "string" && brand.trim()) return brand.trim();
        if (brand && typeof brand === "object") {
          const name = (brand as Record<string, unknown>).name;
          if (typeof name === "string" && name.trim()) return name.trim();
        }
        for (const child of Object.values(obj)) {
          const out = pickBrand(child);
          if (out) return out;
        }
        return null;
      };
      const byJsonLd = pickBrand(parsed);
      if (byJsonLd) return stripHtmlTags(byJsonLd);
    } catch {
      // ignore malformed JSON-LD
    }
  }

  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const artikelId = (url.searchParams.get("id") || "").trim();
  if (!/^\d+$/.test(artikelId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const productUrl = `${JTL_ORIGIN}/navi.php?a=${artikelId}`;
  try {
    const remoteRes = await jtlFetch(productUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        Referer: `${JTL_ORIGIN}/`,
        Origin: JTL_ORIGIN,
      },
    });

    if (!remoteRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch product page", status: remoteRes.status },
        { status: 502 }
      );
    }

    const html = await remoteRes.text();
    const manufacturer = extractManufacturer(html);
    return NextResponse.json(
      { manufacturer, found: Boolean(manufacturer) },
      {
        headers: {
          "x-product-url": productUrl,
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch manufacturer", error);
    return NextResponse.json(
      { error: "Failed to fetch manufacturer" },
      { status: 502 }
    );
  }
}

