"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
};

type Props = {
  onSelectionChange?: (groups: GroupSelection[]) => void;
  onSummChange?: (summ: number) => void;
  widthMm?: number;
  heightMm?: number;
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

function formatPriceEuro(value: number | undefined): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function optionLabel(item: RawConfigItem): string {
  const base = plainLabelFromApi(item.cName);
  const p = item.fPreis?.[1];
  const price = formatPriceEuro(p);
  if (!price) return base;
  // Nicht doppeln, falls Preis schon im cName steht
  if (base.includes("€") || base.includes(price.replace(/\s/g, ""))) return base;
  return `${base} ${price}`;
}

const JTL_IMAGE_BASE = "https://test.schreiber-design.com/";

function buildImageUrl(path: string | null | undefined): string | null {
  const p = (path ?? "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return `${JTL_IMAGE_BASE}${p.slice(1)}`;
  return `${JTL_IMAGE_BASE}${p}`;
}

function readUrlToken(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("token")?.trim();
  return t || null;
}

function readUrlProductId(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const id = sp.get("id")?.trim();
  return id || null;
}

const DEFAULT_ARTIKEL_ID = "17406";
const DEFAULT_ARTICAL_NUMBER = "23582";

function resolveProductIdsFromUrl(): {
  artikelId: string;
  articalNumber: string;
} {
  const fromUrl = readUrlProductId();
  if (fromUrl && /^\d+$/.test(fromUrl)) {
    // URL id у цьому проєкті відповідає артикулу/номерy (artical_number),
    // але JTL поля a/artikel очікують внутрішній kArtikel (для цього товару 17406).
    return { artikelId: DEFAULT_ARTIKEL_ID, articalNumber: fromUrl };
  }
  return {
    artikelId: DEFAULT_ARTIKEL_ID,
    articalNumber: DEFAULT_ARTICAL_NUMBER,
  };
}

/**
 * kKonfiggruppe, die im Original-Shop nicht in den ~16 «Haupt»-Dropdowns stehen,
 * sondern erst erscheinen, wenn Abhängigkeiten sie aktivieren (Position…, Anschluss…, usw.).
 * Ohne diese Regel blendet man bei bAktiv:false fast alles aus → nur 2–3 Selects.
 */
/** Підгрупи, що на сторінці з’являються лише після вибору в «батьківському» селекті (JTL ставить bAktiv). Приклад: Uhr/Wetterstation (11) → Position der Anzeige (428), Anschluss (396). */
const DEFERRED_KONFIG_GRUPPE_IDS = new Set<number>([
  476, 493, 432, 431, 367, 428, 396, 407, 404, 389,
]);

function shouldShowConfigGroupRow(group: RawConfigGroup): boolean {
  const id = group.kKonfiggruppe;
  if (id != null && DEFERRED_KONFIG_GRUPPE_IDS.has(id)) {
    /* Явно вимкнена група: показуємо лише якщо вже є хоч один активний пункт (рідко, але буває в JTL) */
    if (group.bAktiv === false) {
      return group.oItem_arr?.some((i) => i.bAktiv) ?? false;
    }
    /* true або undefined — показуємо (як раніше !== false) */
    return true;
  }
  return true;
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

export default function ConfigStep({
  onSelectionChange,
  onSummChange,
  widthMm: widthMmFromStep1,
  heightMm: heightMmFromStep1,
}: Props) {
  const [configGroups, setConfigGroups] = useState<RawConfigGroup[]>([]);
  const [jtlToken, setJtlToken] = useState<string | null>(null);
  const [configApiWarning, setConfigApiWarning] = useState<string | null>(null);
  const [singleOpenGroupIdx, setSingleOpenGroupIdx] = useState<number | null>(
    null
  );
  const singleDropdownRootRef = useRef<HTMLDivElement | null>(null);
  const lastSentSizeKeyRef = useRef<string | null>(null);

  // Витягуємо response.oKonfig_arr через API, щоб не імпортувати великий JSON напряму
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const urlToken = readUrlToken();
        if (urlToken) setJtlToken(urlToken);
        const apiUrl = urlToken
          ? `/api/config?jtl_token=${encodeURIComponent(urlToken)}`
          : "/api/config";
        const res = await fetch(apiUrl, { cache: "no-store" });
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

  // Пропускаємо першу групу "Spiegelmaß" (розміри), бо її вже конфігуруємо в Step 1
  const optionGroups = useMemo(
    () =>
      configGroups.slice(1),
    [configGroups]
  );

  const [selections, setSelections] = useState<GroupSelection[]>([]);

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

  /** Як у браузері: item[kKonfiggruppe] = { "0": kKonfigitem } для розміру + обраних опцій */
  const buildConfigurationItemMap = (
    groups: RawConfigGroup[],
    opt: RawConfigGroup[],
    nextSelections: GroupSelection[]
  ) => {
    const { customSizeConfigItem, customSizeConfigGroup } =
      deriveEffectiveSizeContext(groups);
    const item: Record<string, { "0": string }> = {};
    if (customSizeConfigGroup && customSizeConfigItem) {
      item[String(customSizeConfigGroup)] = {
        "0": String(customSizeConfigItem),
      };
    }
    for (let i = 0; i < opt.length; i++) {
      const g = opt[i];
      const kg = g.kKonfiggruppe;
      if (kg == null) continue;
      const first = nextSelections.find((s) => s.groupIndex === i)
        ?.selectedItemIds?.[0];
      if (first != null && first > 0) {
        item[String(kg)] = { "0": String(first) };
      }
    }
    return item;
  };

  const mergeSelectionsAfterKonfigResponse = (
    prev: GroupSelection[],
    updated: RawConfigGroup[]
  ): GroupSelection[] =>
    updated.slice(1).map((group, index) => {
      if (group.bAktiv === false) {
        const kept = prev.find((s) => s.groupIndex === index)?.selectedItemIds;
        return { groupIndex: index, selectedItemIds: kept?.length ? kept : [] };
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
        const selected = nextSelections.find((s) => s.groupIndex === idx)
          ?.selectedItemIds?.[0];
        if (selected) return String(selected);
        if (group.bAktiv === false) return "";
        return "";
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

    const updated =
      parseResponseFromVarAssigns(data) ?? groupsBase;
    setConfigGroups(updated);
    setSelections((prev) => mergeSelectionsAfterKonfigResponse(prev, updated));
  };

  /**
   * Як на оригіналі при зміні селекта: спочатку buildConfiguration (оновлений item),
   * потім load_konfig з тим самим items[], що вже відповідає новій конфігурації.
   */
  const buildConfigurationThenLoadKonfig = async (
    nextSelections: GroupSelection[]
  ) => {
    const groups = configGroups;
    if (!groups.length || !nextSelections.length) return;

    const token = jtlToken ?? DEFAULT_JTL_TOKEN_CLIENT;
    const opt = groups.slice(1);
    const { customSizeConfigItem, customSizeConfigGroup, mirrorDims } =
      deriveEffectiveSizeContext(groups);
    const item = buildConfigurationItemMap(groups, opt, nextSelections);

    const { artikelId, articalNumber } = resolveProductIdsFromUrl();

    const buildParams = {
      jtl_token: token,
      inWarenkorb: "1",
      a: artikelId,
      wke: "1",
      show: "1",
      kKundengruppe: "3",
      kSprache: "1",
      eigenschaftwert: { "1601": "", "1602": "" },
      artical_number: articalNumber,
      data_file_exist: "1",
      mir_type: "square",
      str_type: "xside",
      mir_model: "comfort",
      str_widt: "30",
      str_vert_bside: "40",
      str_vert_top: "60",
      str_vert_btm: "60",
      str_hori_bside: "0",
      str_hori_top: "0",
      str_hori_btm: "0",
      shining_sid: "no",
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

    const newGroups = parseResponseFromVarAssigns(buildData);
    if (!newGroups) {
      console.warn("buildConfiguration: no oKonfig_arr in response");
      return;
    }

    /* Одразу з відповіді buildConfiguration: новий список груп + узгоджений вибір → перерендер селектів */
    const mergedAfterBuild = mergeSelectionsAfterKonfigResponse(
      nextSelections,
      newGroups
    );
    setConfigGroups([...newGroups]);
    setSelections(mergedAfterBuild);

    await executeLoadKonfig(mergedAfterBuild, newGroups);
  };

  const handleSingleSelectChange = (groupIdx: number, itemId: number) => {
    setSelections((prev) => {
      const next = prev.map((g) =>
        g.groupIndex === groupIdx
          ? { ...g, selectedItemIds: itemId ? [itemId] : [] }
          : g
      );
      onSelectionChange?.(next);
      void buildConfigurationThenLoadKonfig(next);
      return next;
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
      onSelectionChange?.(next);
      void buildConfigurationThenLoadKonfig(next);
      return next;
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
    void buildConfigurationThenLoadKonfig(selections);
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
        {optionGroups.map((group, idx) => {
          /* Як оригінал: ~16 основних рядків; відкладені групи лише коли bAktiv з бекенда. items[] для load_konfig лишається повним. */
          if (!shouldShowConfigGroupRow(group)) return null;
          if (!group.oItem_arr?.length) return null;

          const selection = selections.find((s) => s.groupIndex === idx);
          const selectedIds = selection?.selectedItemIds ?? [];
          const isSingleChoice = group.nMax === 1;
          const groupTitle = plainLabelFromApi(
            group.oSprache?.cName ?? group.cKommentar ?? ""
          );
          const rowKey = `${idx}-${group.kKonfiggruppe ?? "g"}`;

          const descTooltip =
            plainLabelFromApi(group.oSprache?.cBeschreibung) || undefined;

          return (
            <div className="dimension-group jtl-config-group" key={rowKey}>
              <div className="dimension-header jtl-config-header-label-only">
                <span
                  className="info-icon"
                  aria-hidden="true"
                  title={descTooltip}
                >
                  i
                </span>
                <span className="dimension-label jtl-config-field-label">
                  {groupTitle || "Option"}
                </span>
              </div>
              {isSingleChoice ? (
                <div className="dimension-manual-row jtl-config-inline-row">
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
                <div className="dimension-manual-row jtl-config-inline-row jtl-config-multiselect-block">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

