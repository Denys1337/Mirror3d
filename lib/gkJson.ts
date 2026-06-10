/** JTL gk_json.php — спільні типи та нормалізація ключів (як artikel2short / konfiggruppe2short). */

export type GkStepMap = Record<"2" | "3" | "4", number[]>;

export type GkGruppeEntry = {
  konfiggruppe2short?: string[];
};

export type GkGruppeMap = Record<string, GkGruppeEntry>;

export type GkArticleRule = {
  name: string;
  artikel2short: string[];
  fehler: string;
  operant?: string;
  text: string;
};

export type GkRowHint = {
  text: string;
  isError: boolean;
};

const GK_HINT_ALLOWED_TAGS = new Set([
  "br",
  "b",
  "strong",
  "i",
  "em",
  "p",
  "span",
]);

/** Безпечний HTML для підказок JTL (br, p, b тощо). */
export function sanitizeGkHintHtml(raw: string): string {
  let s = raw.replace(/[\u200B\uFEFF]/g, "").trim();
  if (!s) return "";

  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");

  s = s.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)\/?>/gi, (full, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!GK_HINT_ALLOWED_TAGS.has(tag)) return "";
    if (tag === "br") return "<br />";
    if (full.startsWith("</")) return `</${tag}>`;
    const safeAttrs = attrs
      .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s*style\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return `<${tag}${safeAttrs}>`;
  });

  return s;
}

export function normalizeGkKey(raw: string | undefined | null): string {
  if (!raw) return "";
  let s = raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&szlig;/gi, "ss")
    .replace(/&auml;/gi, "ae")
    .replace(/&ouml;/gi, "oe")
    .replace(/&uuml;/gi, "ue")
    .replace(/&Auml;/gi, "Ae")
    .replace(/&Ouml;/gi, "Oe")
    .replace(/&Uuml;/gi, "Ue")
    .trim()
    .toLowerCase();

  s = s.replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
  return s.replace(/[^a-z0-9+]/g, "");
}

export function keysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8) {
    return a.includes(b) || b.includes(a);
  }
  return false;
}

const GK_LEAF_PREFIXES = [
  "schalterposition",
  "positionder",
  "positioncct",
  "anschlussfurgewahlte",
  "anschluss",
];

function stripGkLeafPrefix(key: string): string {
  for (const prefix of GK_LEAF_PREFIXES) {
    if (key.startsWith(prefix) && key.length > prefix.length + 3) {
      return key.slice(prefix.length);
    }
  }
  return key;
}

/** Збіг ключів JTL (Schalterposition:obenlinks… vs «oben links» у селекті). */
export function gkShortsMatch(a: string, b: string): boolean {
  if (keysMatch(a, b)) return true;
  const sa = stripGkLeafPrefix(a);
  const sb = stripGkLeafPrefix(b);
  if (sa !== a || sb !== b) {
    if (keysMatch(sa, b) || keysMatch(a, sb) || keysMatch(sa, sb)) return true;
  }
  return false;
}

export function collectAllChildGroupShorts(gruppeMap: GkGruppeMap): Set<string> {
  const out = new Set<string>();
  for (const [key, entry] of Object.entries(gruppeMap)) {
    if (!key.trim()) continue;
    for (const short of entry.konfiggruppe2short ?? []) {
      const n = normalizeGkKey(short);
      if (n) out.add(n);
    }
  }
  return out;
}

export function selectedItemKeysFromSelections(
  optionGroups: { oItem_arr: { kKonfigitem: number; cName: string }[] }[],
  selections: { groupIndex: number; selectedItemIds: number[] }[]
): string[] {
  const keys: string[] = [];
  for (const sel of selections) {
    const group = optionGroups[sel.groupIndex];
    if (!group) continue;
    for (const id of sel.selectedItemIds) {
      if (id <= 0) continue;
      const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
      if (!item) continue;
      const k = normalizeGkKey(item.cName);
      if (k) keys.push(k);
    }
  }
  return keys;
}

export function getTriggeredGroupShorts(
  selectedItemKeys: string[],
  gruppeMap: GkGruppeMap
): Set<string> {
  const out = new Set<string>();
  for (const itemKey of selectedItemKeys) {
    let entry: GkGruppeEntry | undefined;
    for (const [mapKey, val] of Object.entries(gruppeMap)) {
      if (!mapKey.trim()) continue;
      if (keysMatch(itemKey, normalizeGkKey(mapKey))) {
        entry = val;
        break;
      }
    }
    if (!entry) continue;
    for (const short of entry.konfiggruppe2short ?? []) {
      const n = normalizeGkKey(short);
      if (n) out.add(n);
    }
  }
  return out;
}

export function buildGroupShortLookup(
  optionGroups: { kKonfiggruppe?: number; oSprache?: { cName?: string }; cKommentar?: string | null }[]
): { kgToShort: Map<number, string>; shortToKg: Map<string, number> } {
  const kgToShort = new Map<number, string>();
  const shortToKg = new Map<string, number>();
  for (const g of optionGroups) {
    const kg = g.kKonfiggruppe;
    if (kg == null) continue;
    const short = normalizeGkKey(g.oSprache?.cName ?? g.cKommentar ?? "");
    if (!short) continue;
    kgToShort.set(kg, short);
    if (!shortToKg.has(short)) shortToKg.set(short, kg);
  }
  return { kgToShort, shortToKg };
}

export function shouldShowConfigGroupFromGk(
  group: {
    kKonfiggruppe?: number;
    bAktiv?: boolean;
    oItem_arr?: { bAktiv: boolean }[];
    oSprache?: { cName?: string };
    cKommentar?: string | null;
  },
  stepGroupIds: Set<number>,
  allChildShorts: Set<string>,
  triggeredShorts: Set<string>,
  kgToShort: Map<number, string>
): boolean {
  const kg = group.kKonfiggruppe;
  if (kg == null) return false;
  if (!stepGroupIds.has(kg)) return false;

  const groupShort = kgToShort.get(kg) ?? normalizeGkKey(group.oSprache?.cName ?? group.cKommentar ?? "");
  if (!groupShort) return true;

  if (!allChildShorts.has(groupShort)) {
    return true;
  }

  if (triggeredShorts.has(groupShort)) return true;

  for (const t of triggeredShorts) {
    if (keysMatch(t, groupShort)) return true;
  }

  // Дочірній селект — тільки після вибору опції з gruppe=1, не через bAktiv від JTL.
  return false;
}

function normalizeRuleTargets(rule: GkArticleRule): string[] {
  return (rule.artikel2short ?? []).map((s) => normalizeGkKey(s)).filter(Boolean);
}

/**
 * Дубль operant "0": у name — конкретна позиція, у artikel2short — тип перемикача.
 * Коректне правило навпаки; ці записи лишають підказку після вибору.
 */
function isInvertedOperant0Rule(rule: GkArticleRule): boolean {
  if ((rule.operant ?? "1") !== "0" || !rule.name.includes(":")) return false;

  const nameN = normalizeGkKey(rule.name);
  const targets = normalizeRuleTargets(rule);
  if (!nameN || !targets.length) return false;

  const nameIsLeaf =
    nameN.startsWith("schalterposition") ||
    nameN.startsWith("positionder") ||
    nameN.startsWith("positioncct") ||
    nameN.startsWith("anschluss");

  const targetsAreLeaf = targets.every(
    (t) =>
      t.startsWith("schalterposition") ||
      t.startsWith("positionder") ||
      t.startsWith("positioncct") ||
      t.startsWith("anschluss") ||
      /^[12]x/.test(t)
  );

  return nameIsLeaf && !targetsAreLeaf;
}

/** Чи обрана опція, що відповідає `rule.name`. */
function isTriggerSelected(ruleName: string, allSelectedShorts: string[]): boolean {
  return allSelectedShorts.some((s) => gkShortsMatch(s, ruleName));
}

/** Вибір у селекті позиції Kosmetikspiegel («Position: LINKS» → positionlinks). */
function isKosmetikPositionChoiceShort(short: string): boolean {
  if (!short) return false;
  return (
    short.startsWith("position") &&
    (short.includes("links") ||
      short.includes("rechts") ||
      short.includes("mitte") ||
      short.includes("oben") ||
      short.includes("unten"))
  );
}

/** Ціль правила article — дочірній селект позиції Kosmetikspiegel. */
function isKosmetikPositionRuleTarget(short: string): boolean {
  if (!short) return false;
  return (
    short.includes("waehlediekosmetikspiegel") ||
    short.includes("positiondeskosmetikspiegel") ||
    (short.includes("kosmetik") && short.includes("position"))
  );
}

/** Чи обрана хоча б одна опція з `artikel2short`. */
function isAnyTargetSelected(
  targets: string[],
  allSelectedShorts: string[]
): boolean {
  if (!targets.length) return false;
  if (allSelectedShorts.some((s) => targets.some((t) => gkShortsMatch(s, t)))) {
    return true;
  }
  if (
    targets.some(isKosmetikPositionRuleTarget) &&
    allSelectedShorts.some(isKosmetikPositionChoiceShort)
  ) {
    return true;
  }
  return false;
}

/** Реальний вибір у single-select (не placeholder «Bitte wählen»). */
export function hasConfigGroupItemSelected(
  group: { oItem_arr: { kKonfigitem: number; cName: string }[] },
  selectedIds: number[]
): boolean {
  const id = selectedIds[0] ?? 0;
  if (id <= 0) return false;
  const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
  if (!item) return false;
  const key = normalizeGkKey(item.cName);
  if (!key || key.includes("bitte") || key.includes("waehlen")) return false;
  if (/^position\s*:/i.test(item.cName.trim())) return true;
  return true;
}

export function isKosmetikPositionGroupTitle(title: string): boolean {
  const t = title.toLowerCase();
  const n = normalizeGkKey(title);
  return (
    (t.includes("kosmetik") && t.includes("position")) ||
    n.includes("waehlediekosmetikspiegel") ||
    n.includes("positiondeskosmetikspiegel")
  );
}

/** Головний селект Kosmetikspiegel (3× Vergrößerung…), не Position / Abstand. */
export function isKosmetikMainGroupTitle(title: string): boolean {
  if (isKosmetikPositionGroupTitle(title)) return false;
  const t = title.toLowerCase();
  const n = normalizeGkKey(title);
  if (t.includes("abstand")) return false;
  return (
    t.includes("kosmetikspiegel") ||
    t.includes("kosmetik") ||
    n.includes("vergroserung")
  );
}

/** Чи обрана позиція в додатковому селекті Kosmetikspiegel (за selections, не лише short-ключами). */
export function hasKosmetikPositionInSelections(
  optionGroups: {
    oItem_arr: { kKonfigitem: number; cName: string }[];
    oSprache?: { cName?: string };
    cKommentar?: string | null;
  }[],
  selections: { groupIndex: number; selectedItemIds: number[] }[]
): boolean {
  for (const sel of selections) {
    const group = optionGroups[sel.groupIndex];
    if (!group) continue;
    const title = group.oSprache?.cName ?? group.cKommentar ?? "";
    if (!isKosmetikPositionGroupTitle(title)) continue;
    if (hasConfigGroupItemSelected(group, sel.selectedItemIds)) return true;
  }
  for (const sel of selections) {
    const group = optionGroups[sel.groupIndex];
    if (!group) continue;
    for (const id of sel.selectedItemIds) {
      if (id <= 0) continue;
      const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
      if (item && /^position\s*:/i.test(item.cName.trim())) return true;
    }
  }
  return false;
}

function isKosmetikPositionPromptPlain(line: string): boolean {
  const t = line
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
  return (
    (t.includes("wahle") || t.includes("waehle") || t.includes("wähle")) &&
    t.includes("position") &&
    t.includes("kosmetik")
  );
}

export function isKosmetikPositionPromptText(text: string): boolean {
  const plain = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return plain
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .some(isKosmetikPositionPromptPlain);
}

function isKosmetikAbstandInstructionPlain(line: string): boolean {
  const t = line
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
  return (
    (t.includes("abstand") &&
      (t.includes("240") ||
        t.includes("mindestabstand") ||
        t.includes("rand des spiegels") ||
        t.includes("mitte"))) ||
    (t.includes("gewunscht") && t.includes("abstand")) ||
    (t.includes("gewünscht") && t.includes("abstand"))
  );
}

export function isKosmetikAbstandInstructionText(text: string): boolean {
  const plain = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return plain
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .some(isKosmetikAbstandInstructionPlain);
}

function splitHintTextParts(html: string): string[] {
  return html
    .split(/(?:<br\s*\/?>|\n)/i)
    .map((p) => p.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}

function stripKosmetikPositionPromptFromHintText(html: string): string {
  const parts = splitHintTextParts(html);
  if (parts.length <= 1) {
    if (parts.length === 1 && isKosmetikPositionPromptPlain(parts[0])) return "";
    return html;
  }
  const kept = parts.filter((p) => !isKosmetikPositionPromptPlain(p));
  if (kept.length === parts.length) return html;
  return kept.join("<br />");
}

function stripKosmetikAbstandInstructionFromHintText(html: string): string {
  const parts = splitHintTextParts(html);
  if (parts.length <= 1) {
    if (parts.length === 1 && isKosmetikAbstandInstructionPlain(parts[0])) return "";
    return html;
  }
  const kept = parts.filter((p) => !isKosmetikAbstandInstructionPlain(p));
  if (kept.length === parts.length) return html;
  return kept.join("<br />");
}

function stripKosmetikFollowUpHintsFromMainRow(html: string): string {
  let s = stripKosmetikPositionPromptFromHintText(html);
  s = stripKosmetikAbstandInstructionFromHintText(s);
  return s.trim();
}

/**
 * operant "1" (AND): `name` обрано і хоча б один `artikel2short` — конфлікт / інфо.
 * operant "0" (NOT ANY): `name` обрано, але жоден `artikel2short` ще не обрано.
 */
export function isArticleRuleConditionMet(
  rule: GkArticleRule,
  allSelectedShorts: string[]
): boolean {
  if (isInvertedOperant0Rule(rule)) return false;

  const ruleName = normalizeGkKey(rule.name);
  if (!ruleName || !isTriggerSelected(ruleName, allSelectedShorts)) return false;

  const targets = normalizeRuleTargets(rule);
  const operant = rule.operant ?? "1";

  if (operant === "0") {
    return targets.length > 0 && !isAnyTargetSelected(targets, allSelectedShorts);
  }
  return targets.length === 0 || isAnyTargetSelected(targets, allSelectedShorts);
}

/** На якому рядку UI показувати текст правила. */
function ruleAppliesToDisplayRow(
  ruleName: string,
  targets: string[],
  groupShort: string,
  selectedInGroupShorts: string[],
  groupItemShorts: string[],
  operant: string
): boolean {
  const isTriggerRow = selectedInGroupShorts.some((s) => gkShortsMatch(s, ruleName));
  const hasTargetItem = groupItemShorts.some((s) =>
    targets.some((t) => gkShortsMatch(s, t))
  );
  const isTargetGroup = targets.some((t) => gkShortsMatch(t, groupShort));
  const isTargetRow =
    isTargetGroup ||
    hasTargetItem ||
    selectedInGroupShorts.some((s) => targets.some((t) => gkShortsMatch(s, t)));

  if (operant === "0") {
    if (hasTargetItem || isTargetGroup) return true;
    if (isTriggerRow) return true;
    return groupItemShorts.some((s) => gkShortsMatch(s, ruleName));
  }

  return isTriggerRow || isTargetRow;
}

export type ConfiguratorStepGroupMap = {
  2: Set<number>;
  3: Set<number>;
  4: Set<number>;
};

export function getConfiguratorStepForKonfigGroup(
  kg: number,
  stepGroupMap: ConfiguratorStepGroupMap | null
): 2 | 3 | 4 | null {
  if (!stepGroupMap) return null;
  for (const step of [2, 3, 4] as const) {
    if (stepGroupMap[step].has(kg)) return step;
  }
  return null;
}

export function areConfigGroupsOnSameConfiguratorStep(
  parentKg: number,
  childKg: number,
  stepGroupMap: ConfiguratorStepGroupMap | null
): boolean {
  if (!stepGroupMap) return true;
  const parentStep = getConfiguratorStepForKonfigGroup(parentKg, stepGroupMap);
  const childStep = getConfiguratorStepForKonfigGroup(childKg, stepGroupMap);
  if (parentStep == null || childStep == null) return true;
  return parentStep === childStep;
}

type ConfigGroupForParentLookup = {
  kKonfiggruppe?: number;
  oSprache?: { cName?: string };
  cKommentar?: string | null;
  oItem_arr: { kKonfigitem: number; cName: string }[];
};

/** Група з опцією-тригером, що відкриває дочірню залежну категорію (gruppeMap). */
export function findTriggeringParentGroupIndex(
  childGroupIndex: number,
  optionGroups: ConfigGroupForParentLookup[],
  selections: { groupIndex: number; selectedItemIds: number[] }[],
  gruppeMap: GkGruppeMap,
  kgToShort: Map<number, string>
): number | null {
  const child = optionGroups[childGroupIndex];
  const childKg = child?.kKonfiggruppe;
  if (childKg == null) return null;
  const childShort =
    kgToShort.get(childKg) ??
    normalizeGkKey(child.oSprache?.cName ?? child.cKommentar ?? "");
  if (!childShort) return null;

  const parentItemKeys = new Set<string>();
  for (const [mapKey, entry] of Object.entries(gruppeMap)) {
    if (!mapKey.trim()) continue;
    for (const short of entry.konfiggruppe2short ?? []) {
      if (gkShortsMatch(normalizeGkKey(short), childShort)) {
        parentItemKeys.add(normalizeGkKey(mapKey));
      }
    }
  }
  if (!parentItemKeys.size) return null;

  for (const sel of selections) {
    const group = optionGroups[sel.groupIndex];
    if (!group) continue;
    for (const id of sel.selectedItemIds) {
      if (id <= 0) continue;
      const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
      if (!item) continue;
      const k = normalizeGkKey(item.cName);
      for (const pk of parentItemKeys) {
        if (gkShortsMatch(k, pk)) return sel.groupIndex;
      }
    }
  }

  for (let i = 0; i < optionGroups.length; i++) {
    const group = optionGroups[i];
    for (const item of group.oItem_arr) {
      const k = normalizeGkKey(item.cName);
      for (const pk of parentItemKeys) {
        if (gkShortsMatch(k, pk)) return i;
      }
    }
  }
  return null;
}

function findParentGroupIndexForOperant0Rule(
  ruleName: string,
  optionGroups: ConfigGroupForParentLookup[],
  selections: { groupIndex: number; selectedItemIds: number[] }[]
): number | null {
  for (const sel of selections) {
    const group = optionGroups[sel.groupIndex];
    if (!group) continue;
    for (const id of sel.selectedItemIds) {
      if (id <= 0) continue;
      const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
      if (!item) continue;
      if (gkShortsMatch(normalizeGkKey(item.cName), ruleName)) {
        return sel.groupIndex;
      }
    }
  }
  for (let i = 0; i < optionGroups.length; i++) {
    const group = optionGroups[i];
    const hasTriggerItem = group.oItem_arr.some((it) =>
      gkShortsMatch(normalizeGkKey(it.cName), ruleName)
    );
    if (hasTriggerItem) return i;
  }
  return null;
}

export function shouldSuppressDependentChildRowMessage(
  childGroupIndex: number,
  childKg: number | undefined,
  optionGroups: ConfigGroupForParentLookup[],
  selections: { groupIndex: number; selectedItemIds: number[] }[],
  gruppeMap: GkGruppeMap,
  kgToShort: Map<number, string>,
  stepGroupMap: ConfiguratorStepGroupMap | null,
  isAdditional: boolean
): boolean {
  if (!isAdditional || childKg == null) return false;
  const parentIdx = findTriggeringParentGroupIndex(
    childGroupIndex,
    optionGroups,
    selections,
    gruppeMap,
    kgToShort
  );
  if (parentIdx == null) return false;
  const parentKg = optionGroups[parentIdx]?.kKonfiggruppe;
  if (parentKg == null) return false;
  return areConfigGroupsOnSameConfiguratorStep(parentKg, childKg, stepGroupMap);
}

export function getRowHintFromArticleRules(
  group: {
    kKonfiggruppe?: number;
    oSprache?: { cName?: string };
    cKommentar?: string | null;
    oItem_arr: { kKonfigitem: number; cName: string }[];
  },
  selections: { groupIndex: number; selectedItemIds: number[] }[],
  optionGroups: typeof group[],
  groupIndex: number,
  rules: GkArticleRule[],
  stepGroupMap: ConfiguratorStepGroupMap | null = null
): GkRowHint | null {
  const groupTitle = group.oSprache?.cName ?? group.cKommentar ?? "";
  const groupShort = normalizeGkKey(groupTitle) || "";
  const isMainKosmetik = isKosmetikMainGroupTitle(groupTitle);
  const isPositionRow = isKosmetikPositionGroupTitle(groupTitle);
  const sel = selections.find((s) => s.groupIndex === groupIndex);
  const selectedIds = sel?.selectedItemIds ?? [];
  const selectedInGroupShorts = selectedIds
    .map((id) => {
      const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
      return item ? normalizeGkKey(item.cName) : "";
    })
    .filter(Boolean);

  const allSelectedShorts = selectedItemKeysFromSelections(optionGroups, selections);
  const kosmetikPositionPicked = hasKosmetikPositionInSelections(
    optionGroups,
    selections
  );

  const groupItemShorts = group.oItem_arr
    .map((it) => normalizeGkKey(it.cName))
    .filter(Boolean);

  const matching: GkRowHint[] = [];

  for (const rule of rules) {
    if (!isArticleRuleConditionMet(rule, allSelectedShorts)) continue;

    const ruleName = normalizeGkKey(rule.name);
    const targets = normalizeRuleTargets(rule);
    const operant = rule.operant ?? "1";

    if (
      !ruleAppliesToDisplayRow(
        ruleName,
        targets,
        groupShort,
        selectedInGroupShorts,
        groupItemShorts,
        operant
      )
    ) {
      continue;
    }

    // operant "0": на одному кроці підказку показуємо лише на батьківському рядку.
    if (operant === "0" && stepGroupMap) {
      const isTriggerRow = selectedInGroupShorts.some((s) =>
        gkShortsMatch(s, ruleName)
      );
      const isTargetGroup = targets.some((t) => gkShortsMatch(t, groupShort));
      const hasTargetItem = groupItemShorts.some((s) =>
        targets.some((t) => gkShortsMatch(s, t))
      );
      const isChildTargetOnly =
        (isTargetGroup || hasTargetItem) && !isTriggerRow;
      if (isChildTargetOnly) {
        const parentIdx = findParentGroupIndexForOperant0Rule(
          ruleName,
          optionGroups,
          selections
        );
        if (parentIdx != null && parentIdx !== groupIndex) {
          const parentKg = optionGroups[parentIdx]?.kKonfiggruppe;
          const childKg = group.kKonfiggruppe;
          if (
            parentKg != null &&
            childKg != null &&
            areConfigGroupsOnSameConfiguratorStep(
              parentKg,
              childKg,
              stepGroupMap
            )
          ) {
            continue;
          }
        }
      }
    }

    // Рядок позиції вже заповнений — не показувати operant "0" під ним.
    if (
      operant === "0" &&
      selectedIds.some((id) => id > 0) &&
      (selectedInGroupShorts.some((s) => targets.some((t) => gkShortsMatch(s, t))) ||
        groupItemShorts.some((s) => targets.some((t) => gkShortsMatch(s, t))))
    ) {
      continue;
    }

    // Підказка про Abstand (240 mm) — лише під селектом позиції, не під головним Kosmetikspiegel.
    if (isKosmetikAbstandInstructionText(rule.text)) {
      if (isMainKosmetik) continue;
      if (!isPositionRow || !kosmetikPositionPicked) continue;
    }

    // Позиція Kosmetikspiegel обрана — прибрати «Bitte wähle die Position…».
    if (kosmetikPositionPicked) {
      if (
        isKosmetikPositionPromptText(rule.text) ||
        (operant === "0" && targets.some(isKosmetikPositionRuleTarget)) ||
        (operant === "0" &&
          allSelectedShorts.some(isKosmetikPositionChoiceShort))
      ) {
        continue;
      }
      if (isMainKosmetik && isKosmetikAbstandInstructionText(rule.text)) {
        continue;
      }
    }

    matching.push({
      text: rule.text.trim(),
      isError: rule.fehler === "1",
    });
  }

  if (!matching.length) return null;
  const err = matching.find((m) => m.isError);
  let picked = err ?? matching[0];

  if (kosmetikPositionPicked && isKosmetikPositionPromptText(picked.text)) {
    const alt = matching.find((m) => !isKosmetikPositionPromptText(m.text));
    if (!alt) return null;
    picked = alt;
  }

  if (kosmetikPositionPicked) {
    let stripped = stripKosmetikPositionPromptFromHintText(picked.text);
    if (isMainKosmetik) {
      stripped = stripKosmetikFollowUpHintsFromMainRow(stripped);
    }
    if (!stripped.trim()) {
      const alt = matching.find(
        (m) =>
          m !== picked &&
          !isKosmetikPositionPromptText(m.text) &&
          !(isMainKosmetik && isKosmetikAbstandInstructionText(m.text))
      );
      if (!alt) return null;
      picked = alt;
      if (isMainKosmetik) {
        const altStripped = stripKosmetikFollowUpHintsFromMainRow(alt.text);
        if (!altStripped.trim()) return null;
        picked = { ...alt, text: altStripped };
      }
    } else {
      picked = { ...picked, text: stripped };
    }
  }

  return picked;
}

export function isDependencyOnlyGroup(
  kg: number | undefined,
  kgToShort: Map<number, string>,
  allChildShorts: Set<string>
): boolean {
  if (kg == null) return false;
  const short = kgToShort.get(kg);
  if (!short) return false;
  return allChildShorts.has(short);
}
