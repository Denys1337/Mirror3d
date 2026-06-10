import { hasKosmetikPositionInSelections } from "./gkJson";

export type KosmetikAbstandKind = "unten" | "seite";

export const KOSMETIK_EIGENSCHAFT_UNTEN = "1601";
export const KOSMETIK_EIGENSCHAFT_SEITE = "1602";

export type KosmetikAbstandFieldView = {
  kind: KosmetikAbstandKind;
  label: string;
  /** Індекс у optionGroups (slice(1)), null — лише локальний fallback */
  groupIndex: number | null;
  kKonfigitem: number | null;
  min: number;
  max: number;
  initial: number;
};

type RawAbstandGroup = {
  nMin: number;
  nMax: number;
  oSprache?: { cName?: string };
  cKommentar?: string | null;
  oItem_arr: {
    kKonfigitem: number;
    bAnzahl?: boolean;
    fInitial?: number;
    fMin?: number;
    fMax?: number;
    bAktiv?: boolean;
  }[];
};

export function plainGroupTitle(group: {
  oSprache?: { cName?: string };
  cKommentar?: string | null;
}): string {
  return (group.oSprache?.cName ?? group.cKommentar ?? "").trim();
}

export function isKosmetikAbstandGroup(group: RawAbstandGroup): boolean {
  const t = plainGroupTitle(group).toLowerCase();
  if (!t.includes("abstand")) return false;
  if (t.includes("position")) return false;
  return (
    t.includes("unten") ||
    t.includes("seite") ||
    t.includes("side") ||
    t.includes("bottom") ||
    t.includes("der seite")
  );
}

export function getKosmetikAbstandKind(
  group: RawAbstandGroup
): KosmetikAbstandKind | null {
  const t = plainGroupTitle(group).toLowerCase();
  if (t.includes("unten") || t.includes("bottom")) return "unten";
  if (t.includes("seite") || t.includes("side")) return "seite";
  return null;
}

export function getKosmetikAbstandItem(group: RawAbstandGroup) {
  const qty = group.oItem_arr.find((i) => i.bAnzahl && i.bAktiv !== false);
  if (qty) return qty;
  return group.oItem_arr.find((i) => i.bAktiv !== false) ?? group.oItem_arr[0];
}

export function clampKosmetikAbstandMm(
  value: number,
  min: number,
  max: number
): number {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) && max > lo ? max : Math.max(lo, 9999);
  const v = Number.isFinite(value) ? value : 0;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function findKosmetikAbstandGroupIndices(
  optionGroups: RawAbstandGroup[]
): number[] {
  const out: number[] = [];
  for (let i = 0; i < optionGroups.length; i++) {
    if (isKosmetikAbstandGroup(optionGroups[i])) out.push(i);
  }
  return sortKosmetikAbstandIndices(out, optionGroups);
}

export function sortKosmetikAbstandIndices(
  indices: number[],
  optionGroups: RawAbstandGroup[]
): number[] {
  return [...indices].sort((a, b) => {
    const ka = getKosmetikAbstandKind(optionGroups[a]) === "unten" ? 0 : 1;
    const kb = getKosmetikAbstandKind(optionGroups[b]) === "unten" ? 0 : 1;
    return ka - kb;
  });
}

const STATIC_ABSTAND_FIELDS: { kind: KosmetikAbstandKind; label: string }[] = [
  { kind: "unten", label: "Abstand von unten" },
  { kind: "seite", label: "Abstand von der Seite" },
];

/** Два поля після вибору позиції (навіть якщо JTL ще не віддав abstand-групи). */
export function buildKosmetikAbstandFields(
  optionGroups: RawAbstandGroup[],
  _widthMm: number,
  _heightMm: number
): KosmetikAbstandFieldView[] {
  const indices = findKosmetikAbstandGroupIndices(optionGroups);
  const byKind = new Map<KosmetikAbstandKind, { index: number; group: RawAbstandGroup }>();
  for (const idx of indices) {
    const g = optionGroups[idx];
    const kind = getKosmetikAbstandKind(g);
    if (kind) byKind.set(kind, { index: idx, group: g });
  }

  return STATIC_ABSTAND_FIELDS.map((def) => {
    const linked = byKind.get(def.kind);
    if (!linked) {
      return {
        kind: def.kind,
        label: def.label,
        groupIndex: null,
        kKonfigitem: null,
        min: 0,
        max: 9999,
        initial: 0,
      };
    }
    const item = getKosmetikAbstandItem(linked.group);
    const min = item?.fMin ?? linked.group.nMin ?? 0;
    const max = item?.fMax ?? linked.group.nMax ?? 9999;
    const initial = item?.fInitial ?? min;
    return {
      kind: def.kind,
      label: def.label,
      groupIndex: linked.index,
      kKonfigitem: item?.kKonfigitem ?? null,
      min,
      max,
      initial,
    };
  });
}

/** Статична червона підказка під полем Abstand (завжди під інпутом). */
export function getKosmetikAbstandFieldHint(kind: KosmetikAbstandKind): string {
  if (kind === "unten") {
    return "Der Abstand von unten muß zwischen 240 und 360 mm liegen.";
  }
  return "Der Spiegel sollte mindestens 480 mm breit sein.";
}

const EMPTY_KOSMETIK_DRAFT: Record<KosmetikAbstandKind, string> = {
  unten: "",
  seite: "",
};

export function emptyKosmetikAbstandDraft(): Record<KosmetikAbstandKind, string> {
  return { ...EMPTY_KOSMETIK_DRAFT };
}

/** Лише цифри під час набору з клавіатури. */
export function sanitizeKosmetikAbstandInput(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Значення для input — без початкового 0. */
export function readKosmetikAbstandInput(
  field: KosmetikAbstandFieldView,
  selections: GroupSelectionSlice[],
  draft: Record<KosmetikAbstandKind, string>
): string {
  const fromDraft = draft[field.kind];
  if (fromDraft !== undefined) {
    return fromDraft;
  }
  if (field.groupIndex != null) {
    const sel = selections.find((s) => s.groupIndex === field.groupIndex);
    if (
      sel?.quantityMm != null &&
      Number.isFinite(sel.quantityMm) &&
      sel.quantityMm > 0
    ) {
      return String(Math.round(sel.quantityMm));
    }
  }
  return "";
}

/** Для JTL: порожнє поле → "", інакше мм у межах min/max. */
export function kosmetikAbstandDraftToJtl(
  raw: string,
  field: KosmetikAbstandFieldView
): string {
  const digits = sanitizeKosmetikAbstandInput(raw);
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return String(clampKosmetikAbstandMm(n, field.min, field.max));
}

export type GroupSelectionSlice = {
  groupIndex: number;
  selectedItemIds: number[];
  quantityMm?: number;
};

/**
 * eigenschaftwert 1601/1602 — лише заповнені мм (рядок).
 * Якщо обидва порожні — undefined (не додавати в payload).
 */
export function buildKosmetikEigenschaftwert(input: {
  fields: KosmetikAbstandFieldView[];
  selections: GroupSelectionSlice[];
  draft: Record<KosmetikAbstandKind, string>;
  positionPicked: boolean;
}): Record<string, string> | undefined {
  if (!input.positionPicked) return undefined;

  const out: Record<string, string> = {};
  for (const field of input.fields) {
    const key =
      field.kind === "unten"
        ? KOSMETIK_EIGENSCHAFT_UNTEN
        : KOSMETIK_EIGENSCHAFT_SEITE;
    const raw = readKosmetikAbstandInput(field, input.selections, input.draft);
    const mm = kosmetikAbstandDraftToJtl(raw, field);
    if (mm) out[key] = mm;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export { hasKosmetikPositionInSelections };
