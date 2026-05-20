/** JTL item map з buildConfiguration: { "249": { "0": "1155" } } */
export type IoItemMap = Record<string, Record<string, string>>;

export type ProductLightingFields = {
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

export type CartItemData = ProductLightingFields & {
  jtl_token: string;
  inWarenkorb: "1";
  a: string;
  wke: "1";
  show: "1";
  kKundengruppe: "";
  kSprache: "1";
  "estimated-delivery": "";
  artical_number: string;
  data_file_exist: "1";
  item: Record<string, (number | string)[]>;
  customSizeConfigItem: string;
  customSizeConfigGroup: string;
  "size-radio": "on";
  breite: string;
  hoehe: string;
  schraege_text: "";
  konfig_comment: "";
  anzahl: string;
};

export type AddToCartRequestBody = {
  product: string;
  token: string;
  sid: string;
  qty: number;
  item_data: CartItemData;
};

export type AddToCartResponse = {
  success?: boolean;
  url?: string;
  error?: string;
  message?: string;
};

/** data_konf.php очікує item[groupId] = [kKonfigitem, …] */
export function ioItemMapToCartItem(
  item: IoItemMap
): Record<string, (number | string)[]> {
  const out: Record<string, (number | string)[]> = {};
  for (const [groupId, slot] of Object.entries(item)) {
    const values = Object.keys(slot)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => {
        const v = slot[k];
        const n = Number(v);
        return Number.isFinite(n) && String(n) === String(v).trim() ? n : v;
      })
      .filter((v) => v !== "" && v != null);
    if (values.length) out[groupId] = values;
  }
  return out;
}

export function buildCartItemData(input: {
  token: string;
  artikelId: string;
  articalNumber: string;
  qty: number;
  lighting: ProductLightingFields;
  item: IoItemMap;
  customSizeConfigItem: string;
  customSizeConfigGroup: string;
  widthMm: number;
  heightMm: number;
}): CartItemData {
  return {
    jtl_token: input.token,
    inWarenkorb: "1",
    a: input.artikelId,
    wke: "1",
    show: "1",
    kKundengruppe: "",
    kSprache: "1",
    "estimated-delivery": "",
    artical_number: input.articalNumber,
    data_file_exist: "1",
    ...input.lighting,
    item: ioItemMapToCartItem(input.item),
    customSizeConfigItem: input.customSizeConfigItem,
    customSizeConfigGroup: input.customSizeConfigGroup,
    "size-radio": "on",
    breite: String(Math.round(input.widthMm)),
    hoehe: String(Math.round(input.heightMm)),
    schraege_text: "",
    konfig_comment: "",
    anzahl: String(input.qty),
  };
}

export function buildAddToCartRequestBody(input: {
  artikelId: string;
  articalNumber: string;
  token: string;
  sid: string;
  qty: number;
  lighting: ProductLightingFields;
  item: IoItemMap;
  customSizeConfigItem: string;
  customSizeConfigGroup: string;
  widthMm: number;
  heightMm: number;
}): AddToCartRequestBody {
  return {
    product: input.artikelId,
    token: input.token,
    sid: input.sid,
    qty: input.qty,
    item_data: buildCartItemData(input),
  };
}
