import {
  parseMirrorUrlParams,
  resolveProductIdsFromUrlParams,
  type MirrorUrlParams,
} from "./urlParams";

export const JTL_SHOP_ORIGIN = "https://test.schreiber-design.com";

function isAllowedShopUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const shop = new URL(JTL_SHOP_ORIGIN);
    return parsed.origin === shop.origin;
  } catch {
    return false;
  }
}

/** URL сторінки товару в JTL-магазині (для кнопки «Zurück zur Produktseite»). */
export function resolveJtlProductPageUrl(
  params: MirrorUrlParams,
  extra?: URLSearchParams | null
): string {
  const sp = extra ?? null;
  const explicit =
    sp?.get("back")?.trim() ||
    sp?.get("return")?.trim() ||
    sp?.get("productUrl")?.trim();
  if (explicit && isAllowedShopUrl(explicit)) {
    return explicit;
  }

  const { artikelId } = resolveProductIdsFromUrlParams(params);
  return `${JTL_SHOP_ORIGIN}/navi.php?a=${artikelId}`;
}

export function resolveJtlProductPageUrlFromSearch(
  input: URLSearchParams | string | null | undefined
): string {
  const sp =
    input == null
      ? new URLSearchParams()
      : typeof input === "string"
        ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
        : input;
  return resolveJtlProductPageUrl(parseMirrorUrlParams(sp), sp);
}
