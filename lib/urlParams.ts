import {
  DEFAULT_ARTIKEL_ID,
  DEFAULT_ARTICAL_NUMBER,
  DEFAULT_SIZE_KONFIG_ITEM,
  resolveProductIds,
} from "./productIds";

/** Параметри з URL магазину Schreiber / embed. */
export type MirrorUrlParams = {
  /** kArtikel (`?id=`) */
  artikelId: string | null;
  /** artical_number (`?n=`) */
  articalNumber: string | null;
  /** kKonfigitem розміру (`?s=`) */
  sizeKonfigItem: string | null;
  /** jtl_token (`?t=`, також `token`, `jtl_token`) */
  jtlToken: string | null;
  /** PHP/JTL session (`?sid=`) */
  sessionId: string | null;
};

export function parseMirrorUrlParams(
  input: URLSearchParams | string | null | undefined
): MirrorUrlParams {
  const sp =
    input == null
      ? new URLSearchParams()
      : typeof input === "string"
        ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
        : input;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = sp.get(k)?.trim();
      if (v) return v;
    }
    return null;
  };

  return {
    artikelId: pick("id"),
    articalNumber: pick("n"),
    sizeKonfigItem: pick("s", "size"),
    jtlToken: pick("t", "token", "jtl_token"),
    sessionId: pick("sid"),
  };
}

export function resolveProductIdsFromUrlParams(
  params: MirrorUrlParams
): { artikelId: string; articalNumber: string } {
  return resolveProductIds(params.artikelId, params.articalNumber);
}

export function resolveSizeKonfigItem(
  params: MirrorUrlParams
): string {
  const s = params.sizeKonfigItem?.trim();
  return s && /^\d+$/.test(s) ? s : DEFAULT_SIZE_KONFIG_ITEM;
}

/** Query для GET /api/config (проксі до JTL). */
export function buildConfigApiSearchParams(
  params: MirrorUrlParams
): URLSearchParams {
  const qs = new URLSearchParams();
  const { artikelId, articalNumber } = resolveProductIdsFromUrlParams(params);
  const sizeItem = resolveSizeKonfigItem(params);

  if (params.jtlToken) qs.set("jtl_token", params.jtlToken);
  qs.set("id", artikelId);
  qs.set("n", articalNumber);
  qs.set("s", sizeItem);
  if (params.sessionId) qs.set("sid", params.sessionId);

  return qs;
}

export function buildConfigApiPath(params: MirrorUrlParams): string {
  const qs = buildConfigApiSearchParams(params);
  const q = qs.toString();
  return q ? `/api/config?${q}` : "/api/config";
}

export const URL_PARAM_DEFAULTS = {
  artikelId: DEFAULT_ARTIKEL_ID,
  articalNumber: DEFAULT_ARTICAL_NUMBER,
  sizeKonfigItem: DEFAULT_SIZE_KONFIG_ITEM,
} as const;
