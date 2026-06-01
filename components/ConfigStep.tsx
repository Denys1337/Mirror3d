"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { buildAddToCartRequestBody } from "../lib/cartPayload";
import type { AddToCartResponse } from "../lib/cartPayload";
import type { ProductLightingPayload } from "../lib/productLighting";
import {
  buildGroupShortLookup,
  collectAllChildGroupShorts,
  getRowHintFromArticleRules,
  getTriggeredGroupShorts,
  hasConfigGroupItemSelected,
  hasKosmetikPositionInSelections,
  isDependencyOnlyGroup,
  isKosmetikPositionGroupTitle,
  isKosmetikPositionPromptText,
  sanitizeGkHintHtml,
  selectedItemKeysFromSelections,
  shouldShowConfigGroupFromGk,
  type GkArticleRule,
  type GkGruppeMap,
} from "../lib/gkJson";
import {
  buildKosmetikAbstandFields,
  buildKosmetikEigenschaftwert,
  clampKosmetikAbstandMm,
  emptyKosmetikAbstandDraft,
  getKosmetikAbstandFieldHint,
  kosmetikAbstandDraftToJtl,
  readKosmetikAbstandInput,
  sanitizeKosmetikAbstandInput,
  type KosmetikAbstandFieldView,
  type KosmetikAbstandKind,
} from "../lib/kosmetikAbstand";
import {
  buildConfigApiPath,
  parseMirrorUrlParams,
  resolveProductIdsFromUrlParams,
} from "../lib/urlParams";

type KonfigErrorEntry = { message?: string; group?: number };

type RawResponse = {
  oKonfig_arr: RawConfigGroup[];
  /** JTL: якщо false — залежні групи (напр. 428) лишаються bAktiv:false; часто «Fehlerhafter Token.» */
  valid?: boolean;
  errorMessages?: Record<string, KonfigErrorEntry>;
  invalidGroups?: number[];
  status?: string;
  summ?: number;
  fGesamtpreis?: number[];
};

function getKonfigResponseValue(data: unknown): RawResponse | undefined {
  const assigns = (data as { varAssigns?: { name: string; value: RawResponse }[] })
    ?.varAssigns;
  if (!Array.isArray(assigns)) return undefined;
  return assigns.find((v) => v.name === "response")?.value;
}

/** Оновлює попередження лише якщо в payload явно є response.valid */
function applyKonfigValidityWarning(
  data: unknown,
  setWarning: (msg: string | null) => void
) {
  const response = getKonfigResponseValue(data);
  if (!response || typeof response !== "object") return;
  if (response.valid === false) {
    setWarning(summarizeKonfigValidityErrors(response));
    return;
  }
  if (response.valid === true) {
    setWarning(null);
  }
}

function getKonfigValidity(data: unknown): boolean | undefined {
  const response = getKonfigResponseValue(data);
  if (!response || typeof response !== "object") return undefined;
  return typeof response.valid === "boolean" ? response.valid : undefined;
}

function collectKonfigErrorTexts(
  msgs: Record<string, KonfigErrorEntry> | undefined
): string[] {
  if (!msgs || typeof msgs !== "object") return [];
  const out: string[] = [];
  for (const v of Object.values(msgs)) {
    if (v == null) continue;
    if (typeof v === "string") {
      out.push(v);
      continue;
    }
    if (typeof v === "object" && typeof v.message === "string" && v.message)
      out.push(v.message);
  }
  return [...new Set(out)];
}

function summarizeKonfigValidityErrors(response: RawResponse): string {
  const texts = collectKonfigErrorTexts(response.errorMessages);
  const invalidPartEarly =
    Array.isArray(response.invalidGroups) && response.invalidGroups.length > 0
      ? ` Групи з помилкою (kKonfiggruppe): ${response.invalidGroups.join(", ")}.`
      : "";
  const tokenErr = texts.some((t) =>
    /fehlerhafter token|invalid token|token/i.test(t)
  );
  if (tokenErr) {
    return (
      "JTL: «Fehlerhafter Token» — токен не збігається з сесією JTL. У .env додайте JTL_TOKEN без лапок (KEY=value), обов’язково JTL_COOKIE з того ж браузера, що й токен (Network → Request Headers → Cookie), перезапустіть dev. Браузер не читає .env напряму: токен для buildConfiguration береться з відповіді GET /api/config (заголовок x-jtl-token) або зі стану після успішних відповідей."
    );
  }
  if (texts.length) {
    return `JTL: конфігурація невалідна — ${texts.slice(0, 4).join("; ")}${texts.length > 4 ? "…" : ""}.${invalidPartEarly}`;
  }
  return (
    "JTL повернув valid:false без тексту в errorMessages (так буває в JTL)." +
      invalidPartEarly +
      " Зазвичай це неповний JTL_COOKIE (увесь рядок Cookie з запиту schreiber-design.com/io), застарілий JTLSHOP або невідповідність токена сесії. Перевір у відповіді /api/config: x-jtl-outbound-cookie=yes та x-jtl-outbound-cookie-pairs."
  );
}

type RawConfigGroup = {
  bAktiv?: boolean;
  kKonfiggruppe?: number;
  cBildPfad?: string | null;
  nMin: number;
  nMax: number;
  nTyp: number;
  cKommentar?: string | null;
  oSprache?: {
    cName?: string;
    cBeschreibung?: string;
  };
  oItem_arr: RawConfigItem[];
};

type RawConfigItem = {
  kKonfigitem: number;
  fPreis?: [number, number];
  /** [0] Brutto (як на сайті), [1] Netto */
  fPreisLocalized?: [string, string];
  cName: string;
  cBeschreibung?: string | null;
  cBildPfad?: string | null;
  bAnzahl: boolean;
  fInitial: number;
  fMin: number;
  fMax: number;
  bAktiv: boolean;
};

type GroupSelection = {
  groupIndex: number;
  selectedItemIds: number[]; // kKonfigitem
  /** мм — Abstand Kosmetikspiegel (JTL bAnzahl) */
  quantityMm?: number;
};

type Props = {
  onSelectionChange?: (groups: GroupSelection[]) => void;
  onSummChange?: (summ: number) => void;
  onSummaryChange?: (summary: ConfigSummaryPayload) => void;
  onManufacturerChange?: (manufacturer: string | null) => void;
  onLightTemperatureChange?: (kelvin: number) => void;
  onAmbientBacklightChange?: (
    mode:
      | "none"
      | "top"
      | "bottom"
      | "sides"
      | "top-sides"
      | "bottom-sides"
      | "top-bottom"
      | "all"
  ) => void;
  widthMm?: number;
  heightMm?: number;
  activeStep?: number;
  /** З /api/product-attributes/{n} — без хардкоду в кошику / buildConfiguration */
  productLightingPayload?: ProductLightingPayload | null;
};

export type ConfigStepHandle = {
  addToCart: () => Promise<void>;
};

export type ConfigSummaryLine = {
  label: string;
  price: string;
};

export type ConfigSummaryPayload = {
  widthMm: number;
  heightMm: number;
  lines: ConfigSummaryLine[];
};

type StepGroupMap = {
  2: Set<number>;
  3: Set<number>;
  4: Set<number>;
};

/** JTL liefert oft HTML-Entities (&szlig;, &auml;) — für UI wie Original ohne Rohtext */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
  const named: Record<string, string> = {
    quot: '"',
    amp: "&",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: "\u00a0",
    szlig: "ß",
    auml: "ä",
    ouml: "ö",
    uuml: "ü",
    Auml: "Ä",
    Ouml: "Ö",
    Uuml: "Ü",
    euro: "€",
  };
  s = s.replace(/&([a-zA-Z]+);/g, (m, name) => named[name] ?? m);
  return s;
}

function plainLabelFromApi(raw: string | undefined | null): string {
  if (!raw) return "";
  const decoded = decodeHtmlEntities(raw);
  return decoded.replace(/<[^>]*>/g, "").trim();
}

function extractManufacturerFromUnknown(data: unknown): string | null {
  const visited = new WeakSet<object>();
  const walk = (value: unknown): string | null => {
    if (value == null) return null;
    if (typeof value !== "object") return null;
    if (visited.has(value as object)) return null;
    visited.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }

    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && /hersteller|manufacturer|brand|marke/i.test(k)) {
        const plain = plainLabelFromApi(v);
        if (plain) return plain;
      }
    }
    for (const child of Object.values(obj)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(data);
}

function formatPriceEuro(value: number | undefined): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function optionDisplayPrice(item: RawConfigItem): string | null {
  const localized = item.fPreisLocalized?.[0];
  if (localized) {
    const plain = plainLabelFromApi(localized);
    if (plain) return plain;
  }
  return formatPriceEuro(item.fPreis?.[0]);
}

function optionLabel(item: RawConfigItem): string {
  const base = plainLabelFromApi(item.cName);
  const price = optionDisplayPrice(item);
  if (!price) return base;
  // Nicht doppeln, falls Preis schon im cName steht
  if (base.includes("€") || base.includes(price.replace(/\s/g, ""))) return base;
  return `${base} ${price}`;
}

const JTL_IMAGE_BASE = "https://test.schreiber-design.com/";
/** Той самий HTML, що на JTL, але через наш API — інакше X-Frame-Options: sameorigin блокує iframe. */
function buildOptionInfoFrameSrc(kKonfiggruppe: number): string {
  return `/api/jtl-option-html/${kKonfiggruppe}`;
}

function buildJtlAssetProxyUrl(rawUrl: string): string {
  return `/api/jtl-asset?url=${encodeURIComponent(rawUrl)}`;
}

function buildImageUrl(path: string | null | undefined): string | null {
  const p = (path ?? "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return `${JTL_IMAGE_BASE}${p.slice(1)}`;
  return `${JTL_IMAGE_BASE}${p}`;
}

function readMirrorUrlParams() {
  if (typeof window === "undefined") {
    return parseMirrorUrlParams("");
  }
  return parseMirrorUrlParams(window.location.search);
}

function readUrlJtlToken(): string {
  const token = readMirrorUrlParams().jtlToken?.trim();
  if (!token) {
    throw new Error("t fehlt in der URL (?t=...)");
  }
  return token;
}

function readUrlSid(): string {
  const sid = readMirrorUrlParams().sessionId?.trim();
  if (!sid) {
    throw new Error("sid fehlt in der URL (?sid=...)");
  }
  return sid;
}

function requireProductLighting(
  payload: ProductLightingPayload | null | undefined
): ProductLightingPayload {
  if (!payload) {
    throw new Error(
      "Produktattribute nicht geladen (/api/product-attributes). Seite mit ?n= und gültiger Session neu öffnen."
    );
  }
  return payload;
}

function resolveProductIdsFromUrl(): {
  artikelId: string;
  articalNumber: string;
} {
  return resolveProductIdsFromUrlParams(readMirrorUrlParams());
}

/** Лише для 3D-превʼю (колір температури), не для видимості селектів. */
const LICHTFARBE_KONFIG_GRUPPE = 261;

function additionalSelectPrompt(groupTitle: string): string {
  const title = groupTitle.trim() || "Option";
  return `Bitte wählen Sie die ${title}`;
}

type GkVisibilityContext = {
  stepGroupIds: Set<number>;
  allChildShorts: Set<string>;
  triggeredShorts: Set<string>;
  kgToShort: Map<number, string>;
};

function buildGkVisibilityContext(
  optionGroups: RawConfigGroup[],
  selections: GroupSelection[],
  activeStep: number,
  stepGroupMap: StepGroupMap | null,
  gruppeMap: GkGruppeMap
): GkVisibilityContext {
  const { kgToShort } = buildGroupShortLookup(optionGroups);
  const allChildShorts = collectAllChildGroupShorts(gruppeMap);
  const itemKeys = selectedItemKeysFromSelections(optionGroups, selections);
  const triggeredShorts = getTriggeredGroupShorts(itemKeys, gruppeMap);
  const stepGroupIds =
    stepGroupMap && (activeStep === 2 || activeStep === 3 || activeStep === 4)
      ? stepGroupMap[activeStep]
      : new Set<number>();
  return { stepGroupIds, allChildShorts, triggeredShorts, kgToShort };
}

function shouldShowConfigGroupRow(
  group: RawConfigGroup,
  ctx: GkVisibilityContext
): boolean {
  if (!ctx.stepGroupIds.size) return true;
  return shouldShowConfigGroupFromGk(
    group,
    ctx.stepGroupIds,
    ctx.allChildShorts,
    ctx.triggeredShorts,
    ctx.kgToShort
  );
}

function pruneSelectionsForHiddenRows(
  optionGroups: RawConfigGroup[],
  selections: GroupSelection[],
  ctx: GkVisibilityContext
): GroupSelection[] {
  let current = selections;
  const passes = Math.max(4, optionGroups.length + 1);
  for (let p = 0; p < passes; p++) {
    let changed = false;
    const next = current.map((sel) => {
      const group = optionGroups[sel.groupIndex];
      if (!group) return sel;
      const visible = shouldShowConfigGroupRow(group, ctx);
      if (!visible && sel.selectedItemIds.length > 0) {
        changed = true;
        return { groupIndex: sel.groupIndex, selectedItemIds: [] };
      }
      return sel;
    });
    current = next;
    if (!changed) break;
  }
  return current;
}

/**
 * Після load_konfig JTL часто ставить bAktiv лише на поточно обраному пункті; інші стають false.
 * Якщо тоді disabled={!item.bAktiv}, переключити селект неможливо — тому для single-select (nMax===1)
 * усі опції лишаються доступними; для multiselect логіку bAktiv зберігаємо.
 */
function itemChoosable(group: RawConfigGroup, item: RawConfigItem): boolean {
  if (group.nMax === 1) return true;
  const anyActive = group.oItem_arr.some((i) => i.bAktiv);
  if (!anyActive) return true;
  return item.bAktiv;
}

function extractJtlToken(data: unknown): string | null {
  const assigns = (data as { varAssigns?: { name: string; value: unknown }[] })
    ?.varAssigns;
  if (!Array.isArray(assigns)) return null;
  for (const a of assigns) {
    if (a?.name === "jtl_token" && typeof a.value === "string") return a.value;
  }
  return null;
}

/** Не оновлюємо jtl_token з відповіді, якщо valid:false — інакше підставляється «битий» токен і цикл помилок. */
function maybeUpdateJtlTokenFromResponse(
  data: unknown,
  setToken: (t: string) => void
) {
  const resp = getKonfigResponseValue(data);
  if (resp?.valid === false) return;
  const nt = extractJtlToken(data);
  if (nt) setToken(nt);
}

/** Лише `summ` з response — UI показує ціну тільки після такої відповіді. */
function extractJtlSumm(data: unknown): number | null {
  const response = getKonfigResponseValue(data);
  if (!response) return null;
  if (typeof response.summ === "number" && Number.isFinite(response.summ)) {
    return response.summ;
  }
  return null;
}

/** Той самий дефолт, що в app/api/config/route.ts */
const DEFAULT_JTL_TOKEN_CLIENT =
  "6c08e5033bc977face39247c0d040e8c354c5038509611843a135f4014ca78fe";

/**
 * Step 2: Konfiguration der Optionen aus der ursprünglichen JTL-Konfiguration (artikel.js / sdfsd.json).
 * Liest die Gruppen aus sdfsd.json und rendert sie als Selects / Checkboxen.
 */
function resolveMirrorDimensions(
  fallback: { widthMm: number; heightMm: number },
  widthFromStep1?: number,
  heightFromStep1?: number
) {
  const w =
    typeof widthFromStep1 === "number" && Number.isFinite(widthFromStep1) && widthFromStep1 > 0
      ? Math.round(widthFromStep1)
      : fallback.widthMm;
  const h =
    typeof heightFromStep1 === "number" && Number.isFinite(heightFromStep1) && heightFromStep1 > 0
      ? Math.round(heightFromStep1)
      : fallback.heightMm;
  return { widthMm: w, heightMm: h };
}

function isFinitePositive(n: number | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function pickCustomSizeItemId(group0: RawConfigGroup | undefined): number | null {
  const items = group0?.oItem_arr ?? [];
  if (!items.length) return null;

  // Найнадійніше для JTL: Sondermaß item (у прикладі це 1155)
  const byName = items.find((i) => /sonderma/i.test(i.cName ?? ""));
  if (byName) return byName.kKonfigitem;

  // fallback: item з кількістю/діапазоном, зазвичай це custom-size
  const byRange = items.find((i) => i.bAnzahl && (i.fMax ?? 0) > 1000);
  if (byRange) return byRange.kKonfigitem;

  return null;
}

function parseKelvinFromLabel(labelRaw: string | undefined | null): number | null {
  const label = plainLabelFromApi(labelRaw ?? "").toLowerCase();
  const kelvinMatch = label.match(/(\d[\d\.\s]{2,6})\s*k/);
  if (kelvinMatch) {
    const normalized = kelvinMatch[1].replace(/[^\d]/g, "");
    const k = Number(normalized);
    if (Number.isFinite(k)) return k;
  }
  if (/cct|einstellbar|2500|6000/.test(label)) return 4000;
  return null;
}

function parseAmbientBacklightModeFromLabel(
  labelRaw: string | undefined | null
):
  | "none"
  | "top"
  | "bottom"
  | "sides"
  | "top-sides"
  | "bottom-sides"
  | "top-bottom"
  | "all" {
  const label = plainLabelFromApi(labelRaw ?? "").toLowerCase();
  if (!label) return "none";
  if (/ohne|kein|none|aus/.test(label)) return "none";

  const hasTop = /oben|top/.test(label);
  const hasBottom = /unten|bottom/.test(label);
  const hasSides = /seite|seiten|seitlich|links|rechts|left|right/.test(label);
  const hasAll = /rundum|umlauf|perimeter|all/.test(label);

  if (hasAll) return "all";
  if (hasTop && hasBottom && hasSides) return "all";
  if (hasTop && hasSides) return "top-sides";
  if (hasBottom && hasSides) return "bottom-sides";
  if (hasTop && hasBottom) return "top-bottom";
  if (hasTop) return "top";
  if (hasBottom) return "bottom";
  if (hasSides) return "sides";
  return "all";
}

function isAmbientLightGroup(group: RawConfigGroup): boolean {
  const title = plainLabelFromApi(group.oSprache?.cName ?? group.cKommentar ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return title.includes("ambientelicht");
}

const ConfigStep = forwardRef<ConfigStepHandle, Props>(function ConfigStep(
  {
    onSelectionChange,
    onSummChange,
    onSummaryChange,
    onManufacturerChange,
    onLightTemperatureChange,
    onAmbientBacklightChange,
    widthMm: widthMmFromStep1,
    heightMm: heightMmFromStep1,
    activeStep = 2,
    productLightingPayload,
  },
  ref
) {
  const [configGroups, setConfigGroups] = useState<RawConfigGroup[]>([]);
  const [stepGroupMap, setStepGroupMap] = useState<StepGroupMap | null>(null);
  const [gkGruppeMap, setGkGruppeMap] = useState<GkGruppeMap>({});
  const [gkArticleRules, setGkArticleRules] = useState<GkArticleRule[]>([]);
  const [jtlToken, setJtlToken] = useState<string | null>(null);
  const [configApiWarning, setConfigApiWarning] = useState<string | null>(null);
  const [, setLastKonfigValid] = useState<boolean | undefined>(undefined);
  const [singleOpenGroupIdx, setSingleOpenGroupIdx] = useState<number | null>(
    null
  );
  const [optionInfoPopup, setOptionInfoPopup] = useState<number | null>(null);
  const [optionInfoHtml, setOptionInfoHtml] = useState<string>("");
  const [optionInfoLoading, setOptionInfoLoading] = useState(false);
  const [optionInfoImagePopup, setOptionInfoImagePopup] = useState<string | null>(
    null
  );
  const singleDropdownRootRef = useRef<HTMLDivElement | null>(null);
  const optionInfoInlineRootRef = useRef<HTMLDivElement | null>(null);
  const lastSentSizeKeyRef = useRef<string | null>(null);

  // Витягуємо response.oKonfig_arr через API, щоб не імпортувати великий JSON напряму
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const urlParams = readMirrorUrlParams();
        if (urlParams.jtlToken) setJtlToken(urlParams.jtlToken);
        const res = await fetch(buildConfigApiPath(urlParams), {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("Failed to load /api/config:", res.status);
          return;
        }
        const data = (await res.json()) as any;
        const varAssigns = data?.varAssigns as
          | { name: string; value: RawResponse }[]
          | undefined;
        const response = varAssigns?.find((v) => v.name === "response")?.value;
        if (!response || !Array.isArray(response.oKonfig_arr)) {
          console.warn("No oKonfig_arr in response");
          return;
        }
        if (!cancelled) {
          console.log("Loaded config groups:", response.oKonfig_arr.length);
          setConfigGroups(response.oKonfig_arr);
          if (onManufacturerChange) {
            onManufacturerChange(extractManufacturerFromUnknown(data));
          }
          /* Той самий токен, що реально використав /api/config (з .env), а не лише з varAssigns */
          const serverTok = res.headers.get("x-jtl-token")?.trim();
          if (serverTok) setJtlToken(serverTok);
          else maybeUpdateJtlTokenFromResponse(data, setJtlToken);
          applyKonfigValidityWarning(data, setConfigApiWarning);
        }
      } catch (e) {
        console.error("Failed to load config from /api/config", e);
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close custom single-select dropdown on outside click.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.(".jtl-single-select-root")) return;
      setSingleOpenGroupIdx(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (optionInfoPopup == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOptionInfoPopup(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [optionInfoPopup]);

  useEffect(() => {
    if (optionInfoPopup == null) return;
    const popupId = optionInfoPopup;
    let cancelled = false;
    async function loadOptionInfoHtml() {
      setOptionInfoLoading(true);
      try {
        const res = await fetch(
          `${buildOptionInfoFrameSrc(popupId)}?fragment=1`,
          { cache: "no-store" }
        );
        const html = await res.text();
        if (!cancelled) {
          setOptionInfoHtml(html);
        }
      } catch {
        if (!cancelled) {
          setOptionInfoHtml(
            "<div style='padding:16px;font-family:Arial,sans-serif'>Fehler beim Laden der Information.</div>"
          );
        }
      } finally {
        if (!cancelled) setOptionInfoLoading(false);
      }
    }
    void loadOptionInfoHtml();
    return () => {
      cancelled = true;
    };
  }, [optionInfoPopup]);

  useEffect(() => {
    const root = optionInfoInlineRootRef.current;
    if (!root || optionInfoPopup == null) return;

    const toAbs = (raw: string | null | undefined): string | null => {
      const v = raw?.trim() ?? "";
      if (!v || v === "#") return null;
      try {
        return new URL(v, JTL_IMAGE_BASE).toString();
      } catch {
        return v;
      }
    };

    const resolveImageAbove = (iconEl: Element): string | null => {
      // На оригіналі іконка живе всередині <a data-featherlight="/bilder/...">
      const anchor = iconEl.closest("a");
      if (anchor) {
        const byFeatherlight = toAbs(anchor.getAttribute("data-featherlight"));
        if (byFeatherlight) return byFeatherlight;
        const byHref = toAbs(anchor.getAttribute("href"));
        if (byHref) return byHref;
        const byImgInAnchor = toAbs(
          anchor.querySelector("img")?.getAttribute("src") ?? null
        );
        if (byImgInAnchor) return byImgInAnchor;
      }

      // Fallback: найближча попередня картинка в загальному контейнері
      const imgs = Array.from(root.querySelectorAll("img"));
      let candidate: HTMLImageElement | null = null;
      for (const img of imgs) {
        if (!(img instanceof HTMLImageElement)) continue;
        if (
          !!(img.compareDocumentPosition(iconEl) & Node.DOCUMENT_POSITION_FOLLOWING)
        ) {
          if (!candidate) candidate = img;
          else if (
            !!(
              candidate.compareDocumentPosition(img) &
              Node.DOCUMENT_POSITION_FOLLOWING
            )
          ) {
            candidate = img;
          }
        }
      }
      return toAbs(candidate?.getAttribute("src"));
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const icon = t.closest(".fa.fa-search");
      if (!icon) return;
      e.preventDefault();
      e.stopPropagation();
      const img = resolveImageAbove(icon);
      if (img) setOptionInfoImagePopup(buildJtlAssetProxyUrl(img));
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [optionInfoPopup, optionInfoHtml]);

  const [selections, setSelections] = useState<GroupSelection[]>([]);
  const [kosmetikAbstandDraft, setKosmetikAbstandDraft] = useState(
    emptyKosmetikAbstandDraft
  );
  const kosmetikAbstandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Пропускаємо першу групу "Spiegelmaß" (розміри), бо її вже конфігуруємо в Step 1
  const optionGroups = useMemo(
    () =>
      configGroups.slice(1),
    [configGroups]
  );

  const allStepGroupIds = useMemo(() => {
    if (!stepGroupMap) return new Set<number>();
    return new Set<number>([
      ...stepGroupMap[2],
      ...stepGroupMap[3],
      ...stepGroupMap[4],
    ]);
  }, [stepGroupMap]);

  const gkPruneCtx = useMemo(
    () =>
      buildGkVisibilityContext(
        optionGroups,
        selections,
        activeStep,
        stepGroupMap,
        gkGruppeMap
      ),
    [optionGroups, selections, activeStep, stepGroupMap, gkGruppeMap]
  );

  const gkPruneCtxAllSteps = useMemo(() => {
    const { kgToShort } = buildGroupShortLookup(optionGroups);
    const allChildShorts = collectAllChildGroupShorts(gkGruppeMap);
    const itemKeys = selectedItemKeysFromSelections(optionGroups, selections);
    const triggeredShorts = getTriggeredGroupShorts(itemKeys, gkGruppeMap);
    return {
      stepGroupIds: allStepGroupIds,
      allChildShorts,
      triggeredShorts,
      kgToShort,
    };
  }, [optionGroups, selections, gkGruppeMap, allStepGroupIds]);

  // gk_json.php: кроки, залежності (gruppe), підказки/помилки (article).
  useEffect(() => {
    let cancelled = false;
    async function loadGkJson() {
      try {
        const { artikelId } = resolveProductIdsFromUrl();
        const res = await fetch(
          `/api/jtl-gk-json?gruppe=1&article=${encodeURIComponent(artikelId || "1")}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          steps?: Record<string, unknown>;
          gruppe?: GkGruppeMap;
          article?: GkArticleRule[];
        };
        if (cancelled) return;
        const toSet = (v: unknown): Set<number> =>
          new Set(
            Array.isArray(v)
              ? v
                  .map((x) => Number(x))
                  .filter((n) => Number.isFinite(n) && n > 0)
              : []
          );
        const steps = data.steps ?? {};
        setStepGroupMap({
          2: toSet(steps["2"]),
          3: toSet(steps["3"]),
          4: toSet(steps["4"]),
        });
        setGkGruppeMap(data.gruppe ?? {});
        setGkArticleRules(Array.isArray(data.article) ? data.article : []);
      } catch {
        // fallback: без мапи — показувати всі групи на step 2
      }
    }
    void loadGkJson();
    return () => {
      cancelled = true;
    };
  }, []);

  const addToCart = useCallback(async () => {
    const token = readUrlJtlToken();
    const sid = readUrlSid();
    if (!configGroups.length) {
      throw new Error("Konfiguration ist noch nicht geladen");
    }

    const lighting = requireProductLighting(productLightingPayload);
    const { artikelId, articalNumber } = resolveProductIdsFromUrl();
    const opt = configGroups.slice(1);
    const item = buildConfigurationItemMap(configGroups, opt, selections);
    const { customSizeConfigItem, customSizeConfigGroup, mirrorDims } =
      deriveEffectiveSizeContext(configGroups);

    const body = buildAddToCartRequestBody({
      artikelId,
      articalNumber,
      token,
      sid,
      qty: 1,
      lighting,
      item,
      customSizeConfigItem: String(customSizeConfigItem),
      customSizeConfigGroup: String(customSizeConfigGroup),
      widthMm: mirrorDims.widthMm,
      heightMm: mirrorDims.heightMm,
    });

    const res = await fetch("/api/add-to-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as AddToCartResponse;
    if (!res.ok) {
      throw new Error(
        data.error || data.message || `Warenkorb fehlgeschlagen (${res.status})`
      );
    }
    if (!data.success || !data.url) {
      throw new Error(
        data.error || data.message || "Warenkorb: unerwartete Antwort vom Server"
      );
    }
    window.location.href = data.url;
  }, [configGroups, selections, productLightingPayload]);

  useImperativeHandle(ref, () => ({ addToCart }), [addToCart]);

  useEffect(() => {
    if (!onLightTemperatureChange) return;
    if (!optionGroups.length || !selections.length) return;

    const lightGroupIndex = optionGroups.findIndex(
      (g) => g.kKonfiggruppe === LICHTFARBE_KONFIG_GRUPPE
    );
    if (lightGroupIndex < 0) return;

    const selectedId =
      selections.find((s) => s.groupIndex === lightGroupIndex)?.selectedItemIds?.[0] ??
      null;
    if (!selectedId) return;

    const selectedItem =
      optionGroups[lightGroupIndex]?.oItem_arr?.find(
        (i) => i.kKonfigitem === selectedId
      ) ?? null;
    if (!selectedItem) return;

    const k = parseKelvinFromLabel(selectedItem.cName);
    if (k != null) onLightTemperatureChange(k);
  }, [optionGroups, selections, onLightTemperatureChange]);

  useEffect(() => {
    if (!onAmbientBacklightChange) return;
    if (!optionGroups.length || !selections.length) return;

    const ambientGroupIndex = optionGroups.findIndex((g) =>
      plainLabelFromApi(g.oSprache?.cName ?? g.cKommentar ?? "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes("ambientelicht")
    );
    if (ambientGroupIndex < 0) {
      onAmbientBacklightChange("none");
      return;
    }

    const selectedId =
      selections.find((s) => s.groupIndex === ambientGroupIndex)?.selectedItemIds?.[0] ??
      null;
    if (!selectedId) {
      onAmbientBacklightChange("none");
      return;
    }

    const selectedItem =
      optionGroups[ambientGroupIndex]?.oItem_arr?.find(
        (i) => i.kKonfigitem === selectedId
      ) ?? null;
    onAmbientBacklightChange(
      parseAmbientBacklightModeFromLabel(selectedItem?.cName)
    );
  }, [optionGroups, selections, onAmbientBacklightChange]);

  useEffect(() => {
    if (!onSummaryChange || configGroups.length === 0) return;
    const { mirrorDims } = deriveEffectiveSizeContext(configGroups);
    const lines: ConfigSummaryLine[] = [];
    const options = configGroups.slice(1);

    options.forEach((group, idx) => {
      const selectedIds =
        selections.find((s) => s.groupIndex === idx)?.selectedItemIds ?? [];
      if (!selectedIds.length) return;
      selectedIds.forEach((selectedId) => {
        const item = group.oItem_arr.find((it) => it.kKonfigitem === selectedId);
        if (!item) return;
        lines.push({
          label: plainLabelFromApi(item.cName),
          price: optionDisplayPrice(item) ?? "0,00 €",
        });
      });
    });

    onSummaryChange({
      widthMm: mirrorDims.widthMm,
      heightMm: mirrorDims.heightMm,
      lines,
    });
  }, [configGroups, onSummaryChange, selections, widthMmFromStep1, heightMmFromStep1]);

  const visibleGroupIndices = useMemo(() => {
    // Поки мапа не завантажилась — не ламаємо UX: на кроках 2..4 показуємо всі групи.
    if (!stepGroupMap) {
      return activeStep >= 2 && activeStep <= 4
        ? optionGroups.map((_, idx) => idx)
        : [];
    }
    if (activeStep !== 2 && activeStep !== 3 && activeStep !== 4) return [];
    const ids = stepGroupMap[activeStep];
    return optionGroups
      .map((g, idx) => ({ idx, kg: g.kKonfiggruppe }))
      .filter((x) => x.kg != null && ids.has(x.kg))
      .map((x) => x.idx);
  }, [activeStep, optionGroups, stepGroupMap]);

  // Не закриваємо dropdown на кожний запит; закриваємо лише якщо група справді зникла.
  useEffect(() => {
    if (singleOpenGroupIdx == null) return;
    const stillInStep = visibleGroupIndices.includes(singleOpenGroupIdx);
    const group = optionGroups[singleOpenGroupIdx];
    const stillVisibleByRules =
      !!group && shouldShowConfigGroupRow(group, gkPruneCtx);
    if (!stillInStep || !stillVisibleByRules) {
      setSingleOpenGroupIdx(null);
    }
  }, [singleOpenGroupIdx, visibleGroupIndices, optionGroups, selections, gkPruneCtx]);

  const emitSummIfExists = (data: unknown) => {
    if (!onSummChange) return;
    const summ = extractJtlSumm(data);
    if (summ != null) {
      onSummChange(summ);
    }
  };

  // Початкова ініціалізація вибору (один раз). Далі — з відповідей buildConfiguration / load_konfig.
  useEffect(() => {
    if (optionGroups.length === 0) return;
    setSelections((prev) => {
      if (prev.length > 0) return prev;
      return optionGroups.map((group, index) => {
        if (group.bAktiv === false) {
          return { groupIndex: index, selectedItemIds: [] };
        }
        const activeItems = group.oItem_arr.filter((item) => item.bAktiv);
        const initialIds =
          activeItems.length > 0
            ? activeItems.map((i) => i.kKonfigitem)
            : group.nMin > 0 && group.oItem_arr[0]
            ? [group.oItem_arr[0].kKonfigitem]
            : [];
        return {
          groupIndex: index,
          selectedItemIds:
            group.nMax === 1 && initialIds.length > 1
              ? [initialIds[0]]
              : initialIds,
        };
      });
    });
  }, [optionGroups]);

  const parseDimensionsFromCustomSizeName = (name: string | undefined) => {
    if (!name) return { widthMm: 400, heightMm: 400 };

    // "Sondergröße; [mm] BxH (400cm x 700cm)"
    const cmMatch = name.match(
      /(\d+(?:\.\d+)?)\s*cm\s*x\s*(\d+(?:\.\d+)?)\s*cm/i
    );
    if (cmMatch) {
      const wCm = Number(cmMatch[1]);
      const hCm = Number(cmMatch[2]);
      return {
        widthMm: Math.round(wCm * 10),
        heightMm: Math.round(hCm * 10),
      };
    }

    // "400 x 400 mm BxH"
    const mmMatch = name.match(/(\d+)\s*x\s*(\d+)\s*mm/i);
    if (mmMatch) {
      return { widthMm: Number(mmMatch[1]), heightMm: Number(mmMatch[2]) };
    }

    return { widthMm: 400, heightMm: 400 };
  };

  const deriveCustomSizeFromGroup0 = (groups: RawConfigGroup[]) => {
    const group0 = groups[0];
    const activeItem =
      group0?.oItem_arr.find((i) => i.bAktiv) ??
      group0?.oItem_arr.find((i) => i.fInitial === 1);

    return {
      customSizeConfigItem: activeItem?.kKonfigitem ?? 0,
      customSizeConfigGroup: group0?.kKonfiggruppe ?? 0,
      ...parseDimensionsFromCustomSizeName(activeItem?.cName),
    };
  };

  const deriveEffectiveSizeContext = (groups: RawConfigGroup[]) => {
    const base = deriveCustomSizeFromGroup0(groups);
    const hasStep1Dims =
      isFinitePositive(widthMmFromStep1) && isFinitePositive(heightMmFromStep1);

    if (!hasStep1Dims) {
      return {
        ...base,
        mirrorDims: { widthMm: base.widthMm, heightMm: base.heightMm },
      };
    }

    const mirrorDims = resolveMirrorDimensions(
      { widthMm: base.widthMm, heightMm: base.heightMm },
      widthMmFromStep1,
      heightMmFromStep1
    );

    // Якщо розмір задається на Step 1 — для коректного перерахунку шлемо Sondermaß item.
    const forcedCustomItem = pickCustomSizeItemId(groups[0]);

    return {
      customSizeConfigItem: forcedCustomItem ?? base.customSizeConfigItem,
      customSizeConfigGroup: base.customSizeConfigGroup,
      widthMm: mirrorDims.widthMm,
      heightMm: mirrorDims.heightMm,
      mirrorDims,
    };
  };

  const kosmetikPositionPicked = useMemo(
    () => hasKosmetikPositionInSelections(optionGroups, selections),
    [optionGroups, selections]
  );

  const kosmetikMirrorDims = useMemo(() => {
    if (!configGroups.length) {
      return {
        widthMm:
          typeof widthMmFromStep1 === "number" && widthMmFromStep1 > 0
            ? widthMmFromStep1
            : 400,
        heightMm:
          typeof heightMmFromStep1 === "number" && heightMmFromStep1 > 0
            ? heightMmFromStep1
            : 400,
      };
    }
    return deriveEffectiveSizeContext(configGroups).mirrorDims;
  }, [configGroups, widthMmFromStep1, heightMmFromStep1]);

  const kosmetikAbstandFields = useMemo(() => {
    if (!kosmetikPositionPicked) return [];
    return buildKosmetikAbstandFields(
      optionGroups,
      kosmetikMirrorDims.widthMm,
      kosmetikMirrorDims.heightMm
    );
  }, [
    kosmetikPositionPicked,
    optionGroups,
    kosmetikMirrorDims.widthMm,
    kosmetikMirrorDims.heightMm,
  ]);

  const buildKonfigItemPreice = (groups: RawConfigGroup[]) => {
    const map: Record<string, number> = {};
    for (const g of groups) {
      for (const it of g.oItem_arr) {
        if (typeof it.fPreis?.[1] === "number") {
          map[String(it.kKonfigitem)] = it.fPreis[1];
        }
      }
    }
    return map;
  };

  /** Відповідь /io майже завжди varAssigns[].name === "response"; на всяк випадок інші шляхи */
  const parseResponseFromVarAssigns = (data: any): RawConfigGroup[] | undefined => {
    if (!data) return undefined;
    const assigns = data.varAssigns as
      | { name: string; value: RawResponse }[]
      | undefined;
    if (Array.isArray(assigns)) {
      const response = assigns.find((v) => v.name === "response")?.value;
      const arr = response?.oKonfig_arr;
      if (Array.isArray(arr)) return arr as RawConfigGroup[];
    }
    const nested = (data as { response?: RawResponse }).response?.oKonfig_arr;
    if (Array.isArray(nested)) return nested as RawConfigGroup[];
    const top = (data as { oKonfig_arr?: RawConfigGroup[] }).oKonfig_arr;
    if (Array.isArray(top)) return top;
    return undefined;
  };

  /**
   * Як на оригінальному JTL: у `item` мають бути усі релевантні групи.
   * Важливо: після кліку в «Uhr / Wetterstation» (kKonfiggruppe 11) JTL часто ще тримає group.bAktiv === false,
   * поки не отримає вибір у buildConfiguration. Раніше ми відсіювали таку групу до читання nextSelections —
   * через це в payload не з’являлось "11":{"0":"2150"} і залежні селекти не вмикались.
   */
  const buildItemSlotForKonfigGroup = (
    group: RawConfigGroup,
    groupIndex: number,
    nextSelections: GroupSelection[]
  ): Record<string, string> | null => {
    if (group.kKonfiggruppe == null) return null;

    const sel =
      nextSelections.find((s) => s.groupIndex === groupIndex)?.selectedItemIds ??
      [];

    const existsInGroup = (id: number) =>
      id > 0 && group.oItem_arr.some((i) => i.kKonfigitem === id);

    const activeFromApi = group.oItem_arr.filter((i) => i.bAktiv);

    if (group.nMax === 1) {
      const s0 = sel[0];
      if (s0 != null && existsInGroup(s0)) {
        return { "0": String(s0) };
      }
      if (group.bAktiv === false) return null;
      let id: number | null = null;
      if (activeFromApi.length > 0) id = activeFromApi[0].kKonfigitem;
      else if (group.nMin > 0 && group.oItem_arr[0])
        id = group.oItem_arr[0].kKonfigitem;
      if (id == null || id <= 0) return null;
      return { "0": String(id) };
    }

    const picked = sel.filter(existsInGroup);
    if (picked.length > 0) {
      const out: Record<string, string> = {};
      picked.forEach((kid, j) => {
        out[String(j)] = String(kid);
      });
      return out;
    }
    if (group.bAktiv === false) return null;
    const ids = activeFromApi.map((i) => i.kKonfigitem);
    if (ids.length === 0) return null;
    const out: Record<string, string> = {};
    ids.forEach((kid, j) => {
      out[String(j)] = String(kid);
    });
    return out;
  };

  /** Як у браузері: item[kKonfiggruppe] = { "0": kKonfigitem, … } для розміру + усіх активних опцій */
  const buildConfigurationItemMap = (
    groups: RawConfigGroup[],
    opt: RawConfigGroup[],
    nextSelections: GroupSelection[]
  ) => {
    const { customSizeConfigItem, customSizeConfigGroup } =
      deriveEffectiveSizeContext(groups);
    const item: Record<string, Record<string, string>> = {};
    if (customSizeConfigGroup && customSizeConfigItem) {
      item[String(customSizeConfigGroup)] = {
        "0": String(customSizeConfigItem),
      };
    }
    for (let i = 0; i < opt.length; i++) {
      const g = opt[i];
      const kg = g.kKonfiggruppe;
      if (kg == null) continue;
      const slot = buildItemSlotForKonfigGroup(g, i, nextSelections);
      if (slot) item[String(kg)] = slot;
    }
    return item;
  };

  const mergeSelectionsAfterKonfigResponse = (
    prev: GroupSelection[],
    updated: RawConfigGroup[],
    useFallbackForInvalid: boolean
  ): GroupSelection[] =>
    updated.slice(1).map((group, index) => {
      if (group.bAktiv === false) {
        // JTL can temporarily return Ambientelicht as inactive while keeping UI selectable;
        // keep previous explicit selection to avoid losing rear backlight state.
        if (isAmbientLightGroup(group)) {
          const kept = prev.find((s) => s.groupIndex === index)?.selectedItemIds ?? [];
          if (kept.length > 0) {
            const existing = kept.filter((id) =>
              group.oItem_arr.some((item) => item.kKonfigitem === id)
            );
            if (existing.length > 0) {
              return {
                groupIndex: index,
                selectedItemIds: group.nMax === 1 ? [existing[0]] : existing,
              };
            }
          }
        }
        if (useFallbackForInvalid) {
          const kept = prev.find((s) => s.groupIndex === index)?.selectedItemIds;
          return { groupIndex: index, selectedItemIds: kept?.length ? kept : [] };
        }
        return { groupIndex: index, selectedItemIds: [] };
      }
      const activeItems = group.oItem_arr.filter((item) => item.bAktiv);
      const prevIds =
        prev.find((s) => s.groupIndex === index)?.selectedItemIds ?? [];

      if (group.nMax === 1 && prevIds.length === 1) {
        const pid = prevIds[0];
        const exists = group.oItem_arr.some((i) => i.kKonfigitem === pid);
        if (
          exists &&
          (activeItems.length === 0 ||
            activeItems.some((i) => i.kKonfigitem === pid))
        ) {
          return { groupIndex: index, selectedItemIds: [pid] };
        }
      }

      const initialIds =
        activeItems.length > 0
          ? activeItems.map((i) => i.kKonfigitem)
          : group.nMin > 0 && group.oItem_arr[0]
            ? [group.oItem_arr[0].kKonfigitem]
            : [];
      return {
        groupIndex: index,
        selectedItemIds:
          group.nMax === 1 && initialIds.length > 1
            ? [initialIds[0]]
            : initialIds,
      };
    });

  const executeLoadKonfig = async (
    nextSelections: GroupSelection[],
    groupsBase: RawConfigGroup[]
  ) => {
    if (!groupsBase.length || !nextSelections.length) return;

    const opt = groupsBase.slice(1);
    const { customSizeConfigItem, customSizeConfigGroup, mirrorDims } =
      deriveEffectiveSizeContext(groupsBase);
    const konfigItemPreice = buildKonfigItemPreice(groupsBase);

    const items = [
      ...opt.map((group, idx) => {
        const slot = buildItemSlotForKonfigGroup(group, idx, nextSelections);
        return slot?.["0"] ?? "";
      }),
      String(customSizeConfigItem),
    ];

    const { artikelId } = resolveProductIdsFromUrl();

    const payloadOrdered = {
      customSizeConfigItem,
      customSizeConfigGroup,
      action: "recalculate_prices",
      items,
      width: mirrorDims.widthMm,
      height: mirrorDims.heightMm,
      width1: mirrorDims.widthMm,
      height1: mirrorDims.heightMm,
      width2: mirrorDims.widthMm,
      height2: mirrorDims.heightMm,
      is_custom_size: 1,
      artikel: artikelId,
      konfigItemPreice,
    };

    const ioBody = `io=${encodeURIComponent(
      JSON.stringify({ name: "load_konfig", params: [payloadOrdered] })
    )}`;

    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ioBody }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("load_konfig failed:", res.status, txt.slice(0, 200));
      return;
    }

    const data = await res.json();
    maybeUpdateJtlTokenFromResponse(data, setJtlToken);
    emitSummIfExists(data);

    applyKonfigValidityWarning(data, setConfigApiWarning);
    const validity = getKonfigValidity(data);
    if (typeof validity === "boolean") setLastKonfigValid(validity);

    const updated = parseResponseFromVarAssigns(data) ?? groupsBase;
    setConfigGroups(updated);
    setSelections((prev) => {
      const merged = mergeSelectionsAfterKonfigResponse(
        prev,
        updated,
        validity === false
      );
      return pruneSelectionsForHiddenRows(updated.slice(1), merged, gkPruneCtxAllSteps);
    });
  };

  /**
   * Як на оригіналі при зміні селекта: спочатку buildConfiguration (оновлений item),
   * потім load_konfig з тим самим items[], що вже відповідає новій конфігурації.
   */
  const buildConfigurationThenLoadKonfig = async (
    nextSelections: GroupSelection[],
    kosmetikDraftOverride?: Record<KosmetikAbstandKind, string>
  ) => {
    const groups = configGroups;
    if (!groups.length || !nextSelections.length) return;

    const token = readUrlJtlToken();
    const lighting = requireProductLighting(productLightingPayload);
    const opt = groups.slice(1);
    const { customSizeConfigItem, customSizeConfigGroup, mirrorDims } =
      deriveEffectiveSizeContext(groups);
    const item = buildConfigurationItemMap(groups, opt, nextSelections);
    const positionPicked = hasKosmetikPositionInSelections(opt, nextSelections);
    const abstandFields = buildKosmetikAbstandFields(
      opt,
      mirrorDims.widthMm,
      mirrorDims.heightMm
    );
    const eigenschaftwert = buildKosmetikEigenschaftwert({
      fields: abstandFields,
      selections: nextSelections,
      draft: kosmetikDraftOverride ?? kosmetikAbstandDraft,
      positionPicked,
    });

    const { artikelId, articalNumber } = resolveProductIdsFromUrl();

    const buildParams = {
      jtl_token: token,
      inWarenkorb: "1",
      a: artikelId,
      wke: "1",
      show: "1",
      kKundengruppe: "3",
      kSprache: "1",
      eigenschaftwert,
      artical_number: articalNumber,
      data_file_exist: "1",
      mir_type: lighting.mir_type,
      str_type: lighting.str_type,
      mir_model: lighting.mir_model,
      str_widt: lighting.str_widt,
      str_vert_bside: lighting.str_vert_bside,
      str_vert_top: lighting.str_vert_top,
      str_vert_btm: lighting.str_vert_btm,
      str_hori_bside: lighting.str_hori_bside,
      str_hori_top: lighting.str_hori_top,
      str_hori_btm: lighting.str_hori_btm,
      shining_sid: lighting.shining_sid,
      item,
      customSizeConfigItem: String(customSizeConfigItem),
      customSizeConfigGroup: String(customSizeConfigGroup),
      breite: String(mirrorDims.widthMm),
      hoehe: String(mirrorDims.heightMm),
      schraege_text: "",
      konfig_comment: "",
      anzahl: "1",
    };

    const buildIoBody = `io=${encodeURIComponent(
      JSON.stringify({ name: "buildConfiguration", params: [buildParams] })
    )}`;

    const buildRes = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ioBody: buildIoBody }),
    });

    if (!buildRes.ok) {
      const txt = await buildRes.text().catch(() => "");
      console.error("buildConfiguration failed:", buildRes.status, txt.slice(0, 200));
      return;
    }

    const buildData = await buildRes.json();
    maybeUpdateJtlTokenFromResponse(buildData, setJtlToken);
    emitSummIfExists(buildData);

    applyKonfigValidityWarning(buildData, setConfigApiWarning);
    const validity = getKonfigValidity(buildData);
    if (typeof validity === "boolean") setLastKonfigValid(validity);

    const newGroups = parseResponseFromVarAssigns(buildData);
    if (!newGroups) {
      console.warn("buildConfiguration: no oKonfig_arr in response");
      return;
    }

    /* Одразу з відповіді buildConfiguration: новий список груп + узгоджений вибір → перерендер селектів */
    const mergedAfterBuild = mergeSelectionsAfterKonfigResponse(
      nextSelections,
      newGroups,
      validity === false
    );
    const prunedAfterBuild = pruneSelectionsForHiddenRows(
      newGroups.slice(1),
      mergedAfterBuild,
      gkPruneCtxAllSteps
    );
    setConfigGroups([...newGroups]);
    setSelections(prunedAfterBuild);

    await executeLoadKonfig(prunedAfterBuild, newGroups);
  };

  const scheduleKosmetikAbstandReload = (
    pruned: GroupSelection[],
    draft: Record<KosmetikAbstandKind, string>
  ) => {
    if (kosmetikAbstandDebounceRef.current) {
      clearTimeout(kosmetikAbstandDebounceRef.current);
    }
    kosmetikAbstandDebounceRef.current = setTimeout(() => {
      kosmetikAbstandDebounceRef.current = null;
      void buildConfigurationThenLoadKonfig(pruned, draft);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (kosmetikAbstandDebounceRef.current) {
        clearTimeout(kosmetikAbstandDebounceRef.current);
      }
    };
  }, []);

  const applyKosmetikAbstandDraft = (
    field: KosmetikAbstandFieldView,
    draftText: string,
    syncJtl: boolean
  ) => {
    const nextDraft = { ...kosmetikAbstandDraft, [field.kind]: draftText };
    setKosmetikAbstandDraft(nextDraft);

    const jtlMm = kosmetikAbstandDraftToJtl(draftText, field);
    const quantityMm =
      jtlMm === "" ? undefined : Number(jtlMm);

    setSelections((prev) => {
      let next = prev.map((s) => ({ ...s }));
      if (field.groupIndex != null && field.kKonfigitem != null) {
        const existingIdx = next.findIndex((s) => s.groupIndex === field.groupIndex);
        const row: GroupSelection = {
          groupIndex: field.groupIndex,
          selectedItemIds: [field.kKonfigitem],
          ...(quantityMm != null ? { quantityMm } : {}),
        };
        if (existingIdx >= 0) next[existingIdx] = row;
        else next.push(row);
      }
      const pruned = pruneSelectionsForHiddenRows(
        optionGroups,
        next,
        gkPruneCtxAllSteps
      );
      onSelectionChange?.(pruned);
      if (syncJtl) scheduleKosmetikAbstandReload(pruned, nextDraft);
      return pruned;
    });
  };

  const handleKosmetikAbstandInput = (
    field: KosmetikAbstandFieldView,
    rawValue: string
  ) => {
    applyKosmetikAbstandDraft(field, sanitizeKosmetikAbstandInput(rawValue), true);
  };

  const handleKosmetikAbstandBlur = (
    field: KosmetikAbstandFieldView,
    rawValue: string
  ) => {
    const digits = sanitizeKosmetikAbstandInput(rawValue);
    if (!digits) {
      applyKosmetikAbstandDraft(field, "", true);
      return;
    }
    const mm = clampKosmetikAbstandMm(Number(digits), field.min, field.max);
    applyKosmetikAbstandDraft(field, String(mm), true);
  };

  const handleSingleSelectChange = (groupIdx: number, itemId: number) => {
    const selectedGroup = optionGroups[groupIdx];
    if (
      selectedGroup?.kKonfiggruppe === LICHTFARBE_KONFIG_GRUPPE &&
      onLightTemperatureChange
    ) {
      const selectedItem = selectedGroup.oItem_arr.find(
        (it) => it.kKonfigitem === itemId
      );
      const k = parseKelvinFromLabel(selectedItem?.cName);
      if (k != null) onLightTemperatureChange(k);
    }
    if (onAmbientBacklightChange) {
      const groupTitle = plainLabelFromApi(
        selectedGroup?.oSprache?.cName ?? selectedGroup?.cKommentar ?? ""
      )
        .toLowerCase()
        .replace(/\s+/g, "");
      if (groupTitle.includes("ambientelicht")) {
        const selectedItem = selectedGroup?.oItem_arr.find(
          (it) => it.kKonfigitem === itemId
        );
        onAmbientBacklightChange(
          parseAmbientBacklightModeFromLabel(selectedItem?.cName)
        );
      }
    }

    setSelections((prev) => {
      const next = prev.map((g) =>
        g.groupIndex === groupIdx
          ? { ...g, selectedItemIds: itemId ? [itemId] : [] }
          : g
      );
      const pruned = pruneSelectionsForHiddenRows(optionGroups, next, gkPruneCtxAllSteps);
      onSelectionChange?.(pruned);
      void buildConfigurationThenLoadKonfig(pruned);
      return pruned;
    });
  };

  const handleMultiToggle = (groupIdx: number, itemId: number) => {
    setSelections((prev) => {
      const next = prev.map((g) => {
        if (g.groupIndex !== groupIdx) return g;
        const already = g.selectedItemIds.includes(itemId);
        let newIds: number[];
        if (already) {
          newIds = g.selectedItemIds.filter((id) => id !== itemId);
        } else {
          newIds = [...g.selectedItemIds, itemId];
        }
        // Не перевищувати nMax, якщо він > 0
        const group = optionGroups[groupIdx];
        if (group.nMax > 0 && newIds.length > group.nMax) {
          newIds = newIds.slice(-group.nMax);
        }
        return { ...g, selectedItemIds: newIds };
      });
      const pruned = pruneSelectionsForHiddenRows(optionGroups, next, gkPruneCtxAllSteps);
      onSelectionChange?.(pruned);
      void buildConfigurationThenLoadKonfig(pruned);
      return pruned;
    });
  };

  // Якщо розмір на Step 1 змінився — одразу перерахувати конфігурацію/ціну на бекенді.
  useEffect(() => {
    if (!configGroups.length || !selections.length) return;
    if (
      typeof widthMmFromStep1 !== "number" ||
      !Number.isFinite(widthMmFromStep1) ||
      widthMmFromStep1 <= 0 ||
      typeof heightMmFromStep1 !== "number" ||
      !Number.isFinite(heightMmFromStep1) ||
      heightMmFromStep1 <= 0
    ) {
      return;
    }

    const sizeKey = `${Math.round(widthMmFromStep1)}x${Math.round(
      heightMmFromStep1
    )}`;
    if (lastSentSizeKeyRef.current === sizeKey) return;

    lastSentSizeKeyRef.current = sizeKey;
    void buildConfigurationThenLoadKonfig(
      pruneSelectionsForHiddenRows(optionGroups, selections, gkPruneCtxAllSteps)
    );
  }, [
    widthMmFromStep1,
    heightMmFromStep1,
    selections,
    configGroups.length,
  ]);

  if (configGroups.length === 0) {
    return (
      <section className="config-step-2 config-jtl-compact">
        <div className="config-section">
          <div className="jtl-config-loading">
            Konfigurationsdaten werden geladen...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="config-step-2 config-jtl-compact">
      <div className="config-section">
        {visibleGroupIndices.map((idx) => {
          const group = optionGroups[idx];
          if (!shouldShowConfigGroupRow(group, gkPruneCtx)) return null;
          if (!group.oItem_arr?.length) return null;

          const selection = selections.find((s) => s.groupIndex === idx);
          const selectedIds = selection?.selectedItemIds ?? [];
          const isSingleChoice = group.nMax === 1;
          const groupTitle = plainLabelFromApi(
            group.oSprache?.cName ?? group.cKommentar ?? ""
          );
          const aktivSig = group.oItem_arr
            .filter((i) => i.bAktiv)
            .map((i) => i.kKonfigitem)
            .join("-");
          const rowKey = `${idx}-${group.kKonfiggruppe ?? "g"}-${aktivSig || "na"}`;

          const kg = group.kKonfiggruppe;
          const isAdditional = isDependencyOnlyGroup(
            kg,
            gkPruneCtx.kgToShort,
            gkPruneCtx.allChildShorts
          );
          const hasSelection = isSingleChoice
            ? hasConfigGroupItemSelected(group, selectedIds)
            : selectedIds.length > 0;
          const isKosmetikPositionRow = isKosmetikPositionGroupTitle(groupTitle);
          const showAdditionalPrompt = isAdditional && !hasSelection;
          let rowHint = getRowHintFromArticleRules(
            group,
            selections,
            optionGroups,
            idx,
            gkArticleRules
          );
          if (
            isKosmetikPositionRow &&
            hasSelection &&
            rowHint &&
            isKosmetikPositionPromptText(rowHint.text)
          ) {
            rowHint = null;
          }
          const showMessageBelow =
            isKosmetikPositionRow && hasSelection
              ? rowHint != null
              : rowHint != null || showAdditionalPrompt;

          return (
            <div
              className={
                "dimension-group jtl-config-group" +
                (isAdditional ? " jtl-config-additional" : "") +
                (showAdditionalPrompt ? " jtl-config-additional--empty" : "")
              }
              key={rowKey}
            >
              {!isAdditional ? (
                <div className="dimension-header jtl-config-header-label-only">
                  {kg != null ? (
                    <button
                      type="button"
                      className="info-icon jtl-option-info-trigger"
                      aria-label={
                        groupTitle
                          ? `Infoseite: ${groupTitle}`
                          : "Infoseite zur Option"
                      }
                      aria-haspopup="dialog"
                      onClick={() => {
                        setSingleOpenGroupIdx(null);
                        setOptionInfoPopup(kg);
                      }}
                    >
                      i
                    </button>
                  ) : null}
                  <span className="dimension-label jtl-config-field-label">
                    {groupTitle || "Option"}
                  </span>
                </div>
              ) : null}
              {isSingleChoice ? (
                <div
                  className={
                    "dimension-manual-row jtl-config-inline-row" +
                    (isAdditional ? " jtl-config-additional-row" : "")
                  }
                >
                  <div className="dimension-manual-input-wrapper jtl-config-select-shell jtl-config-select-shell--grow">
                    <div
                      className="jtl-single-select-root"
                      ref={singleDropdownRootRef}
                      style={{ position: "relative", width: "100%" }}
                    >
                      {(() => {
                        const selectedId = selectedIds[0] ?? 0;
                        const selectedItem =
                          group.oItem_arr.find(
                            (it) => it.kKonfigitem === selectedId
                          ) ?? null;
                        const selectedImg = buildImageUrl(
                          selectedItem?.cBildPfad ?? null
                        );
                        const selectedText =
                          selectedItem != null
                            ? optionLabel(selectedItem)
                            : "Bitte wählen";

                        const toggleOpen = () => {
                          setSingleOpenGroupIdx((prev) =>
                            prev === idx ? null : idx
                          );
                        };

                        return (
                          <>
                            <button
                              type="button"
                              className="dimension-manual-input jtl-config-select jtl-single-select-button"
                              aria-label={groupTitle || "Option"}
                              title={groupTitle || undefined}
                              onClick={toggleOpen}
                            >
                              {selectedImg ? (
                                <img
                                  className="jtl-option-thumb"
                                  src={selectedImg}
                                  alt=""
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span className="jtl-single-select-button-text">
                                {selectedText}
                              </span>
                              <span
                                className="jtl-single-select-caret"
                                aria-hidden="true"
                              >
                                ▾
                              </span>
                            </button>

                            {singleOpenGroupIdx === idx ? (
                              <ul className="jtl-single-select-menu" role="listbox">
                                {group.oItem_arr.map((item) => {
                                  const disabled = !itemChoosable(group, item);
                                  const itemImg = buildImageUrl(item.cBildPfad);
                                  const active =
                                    item.kKonfigitem === selectedIds[0];
                                  return (
                                    <li key={item.kKonfigitem}>
                                      <button
                                        type="button"
                                        className={
                                          "jtl-single-select-option" +
                                          (disabled ? " is-disabled" : "") +
                                          (active ? " is-active" : "")
                                        }
                                        disabled={disabled}
                                        onClick={() => {
                                          handleSingleSelectChange(idx, item.kKonfigitem);
                                          setSingleOpenGroupIdx(null);
                                        }}
                                      >
                                        {itemImg ? (
                                          <img
                                            className="jtl-option-thumb"
                                            src={itemImg}
                                            alt=""
                                            aria-hidden="true"
                                          />
                                        ) : null}
                                        <span className="jtl-single-select-option-text">
                                          {optionLabel(item)}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    "dimension-manual-row jtl-config-inline-row jtl-config-multiselect-block" +
                    (isAdditional ? " jtl-config-additional-row" : "")
                  }
                >
                  <div className="options-multiselect jtl-options-multiselect jtl-options-multiselect--grow">
                    {group.oItem_arr.map((item) => {
                      const checked = selectedIds.includes(
                        item.kKonfigitem
                      );
                      const disabled = !itemChoosable(group, item);
                      const itemImg = buildImageUrl(item.cBildPfad);
                      return (
                        <label
                          key={item.kKonfigitem}
                          className="lighting-shelf-row jtl-checkbox-row"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => {
                              if (disabled) return;
                              handleMultiToggle(idx, item.kKonfigitem);
                            }}
                          />
                          {itemImg ? (
                            <img
                              className="jtl-option-thumb"
                              src={itemImg}
                              alt=""
                              aria-hidden="true"
                            />
                          ) : null}
                          <span>{optionLabel(item)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {showMessageBelow ? (
                <div className="jtl-config-row-message">
                  {rowHint ? (
                    <span
                      className={
                        rowHint.isError
                          ? "jtl-config-row-hint jtl-config-row-hint--error"
                          : "jtl-config-row-hint jtl-config-row-hint--info"
                      }
                      dangerouslySetInnerHTML={{
                        __html: sanitizeGkHintHtml(rowHint.text),
                      }}
                    />
                  ) : (
                    <span className="jtl-config-additional-prompt">
                      {additionalSelectPrompt(groupTitle)}
                    </span>
                  )}
                </div>
              ) : null}
              {isKosmetikPositionRow &&
              hasSelection &&
              kosmetikAbstandFields.length > 0
                ? kosmetikAbstandFields.map((field) => {
                    const inputValue = readKosmetikAbstandInput(
                      field,
                      selections,
                      kosmetikAbstandDraft
                    );
                    const fieldHint = getKosmetikAbstandFieldHint(field.kind);
                    return (
                      <div
                        key={field.kind}
                        className="jtl-config-kosmetik-abstand-block"
                      >
                        <div className="jtl-config-quantity-row">
                          <span className="jtl-config-quantity-label-block">
                            <span className="jtl-config-field-label">
                              {field.label}
                            </span>
                          </span>
                          <div className="jtl-config-quantity-input-wrap">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="jtl-config-quantity-input"
                              value={inputValue}
                              placeholder=""
                              aria-label={field.label}
                              onChange={(e) =>
                                handleKosmetikAbstandInput(field, e.target.value)
                              }
                              onBlur={(e) =>
                                handleKosmetikAbstandBlur(field, e.target.value)
                              }
                            />
                            <div className="jtl-config-kosmetik-abstand-hint">
                              <span className="jtl-config-row-hint jtl-config-row-hint--error">
                                {fieldHint}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
      {typeof document !== "undefined" &&
        optionInfoPopup != null &&
        createPortal(
          <div
            className="jtl-option-html-backdrop"
            role="presentation"
            onClick={() => setOptionInfoPopup(null)}
          >
            <div
              className="jtl-option-html-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Option — Information"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jtl-option-html-toolbar">
                <button
                  type="button"
                  className="jtl-option-html-close"
                  aria-label="Schließen"
                  onClick={() => setOptionInfoPopup(null)}
                >
                  ×
                </button>
              </div>
              <div className="jtl-option-html-frame-wrap">
                {optionInfoLoading ? (
                  <div className="jtl-option-html-loading">Loading...</div>
                ) : (
                  <div
                    ref={optionInfoInlineRootRef}
                    className="jtl-option-html-inline"
                    dangerouslySetInnerHTML={{ __html: optionInfoHtml }}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      {typeof document !== "undefined" &&
        optionInfoImagePopup &&
        createPortal(
          <div
            className="jtl-option-image-backdrop"
            role="presentation"
            onClick={() => setOptionInfoImagePopup(null)}
          >
            <div
              className="jtl-option-image-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Bildvorschau"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="jtl-option-image-close"
                aria-label="Schließen"
                onClick={() => setOptionInfoImagePopup(null)}
              >
                ×
              </button>
              <img
                className="jtl-option-image-preview"
                src={optionInfoImagePopup}
                alt=""
              />
            </div>
          </div>,
          document.body
        )}
    </section>
  );
});

export default ConfigStep;

