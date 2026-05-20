/** kArtikel (JTL `a=`, URL `id`). */
export const DEFAULT_ARTIKEL_ID = "17406";
/** artical_number (URL `n`, файл product_attributes). */
export const DEFAULT_ARTICAL_NUMBER = "23582";
/** kKonfigitem Sondermaß (URL `s`). */
export const DEFAULT_SIZE_KONFIG_ITEM = "1155";

export function resolveProductIds(
  artikelId: string | null | undefined,
  articalNumber: string | null | undefined
): { artikelId: string; articalNumber: string } {
  const a =
    artikelId?.trim() && /^\d+$/.test(artikelId.trim())
      ? artikelId.trim()
      : DEFAULT_ARTIKEL_ID;
  const n =
    articalNumber?.trim() && /^\d+$/.test(articalNumber.trim())
      ? articalNumber.trim()
      : DEFAULT_ARTICAL_NUMBER;
  return { artikelId: a, articalNumber: n };
}

export function resolveProductAttributesId(
  artikelId: string | null | undefined,
  articalNumber: string | null | undefined
): string {
  return resolveProductIds(artikelId, articalNumber).articalNumber;
}
