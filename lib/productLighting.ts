export type ProductLightingPayload = {
  mir_type: string;
  str_type: string;
  mir_model: string;
  str_widt: string;
  str_vert_bside: string;
  str_vert_top: string;
  str_vert_btm: string;
  str_hori_bside: string;
  str_hori_top: string;
  str_hori_btm: string;
  shining_sid: string;
};

const REQUIRED_KEYS: (keyof ProductLightingPayload)[] = [
  "mir_type",
  "str_type",
  "mir_model",
  "str_widt",
  "str_vert_bside",
  "str_vert_top",
  "str_vert_btm",
  "str_hori_bside",
  "str_hori_top",
  "str_hori_btm",
  "shining_sid",
];

/** Лише з відповіді /api/product-attributes/{n} — без fallback-значень. */
export function parseProductLightingPayload(
  data: Record<string, unknown>
): ProductLightingPayload | null {
  for (const key of REQUIRED_KEYS) {
    const v = data[key];
    if (v == null || String(v).trim() === "") return null;
  }
  return {
    mir_type: String(data.mir_type),
    str_type: String(data.str_type),
    mir_model: String(data.mir_model),
    str_widt: String(data.str_widt),
    str_vert_bside: String(data.str_vert_bside),
    str_vert_top: String(data.str_vert_top),
    str_vert_btm: String(data.str_vert_btm),
    str_hori_bside: String(data.str_hori_bside),
    str_hori_top: String(data.str_hori_top),
    str_hori_btm: String(data.str_hori_btm),
    shining_sid: String(data.shining_sid),
  };
}
