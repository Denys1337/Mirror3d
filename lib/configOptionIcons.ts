import {
  hasConfigGroupItemSelected,
  isKosmetikMainGroupTitle,
} from "./gkJson";

export type ConfigOptionIcon = {
  id: string;
  src: string;
  label: string;
};

type ConfigGroup = {
  kKonfiggruppe?: number;
  nMax?: number;
  oSprache?: { cName?: string };
  cKommentar?: string | null;
  oItem_arr: { kKonfigitem: number; cName: string }[];
};

type GroupSelection = {
  groupIndex: number;
  selectedItemIds: number[];
};

function plainLabel(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.replace(/<[^>]*>/g, "").trim();
}

function groupTitle(group: ConfigGroup): string {
  return plainLabel(group.oSprache?.cName ?? group.cKommentar ?? "");
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "");
}

function isNegativeOptionLabel(label: string): boolean {
  const t = label.toLowerCase().trim();
  if (!t) return true;
  if (/^nein\b/.test(t)) return true;
  if (/^ohne\b/.test(t)) return true;
  if (/\bkeine?\b/.test(t)) return true;
  if (/nicht\s+gew/.test(t)) return true;
  if (/standardspiegelohne/.test(t.replace(/\s+/g, ""))) return true;
  return false;
}

function groupHasPositiveSelection(
  group: ConfigGroup,
  selection: GroupSelection | undefined
): boolean {
  const ids = selection?.selectedItemIds ?? [];
  if (!ids.length) return false;

  if (group.nMax === 1) {
    if (!hasConfigGroupItemSelected(group, ids)) return false;
    const item = group.oItem_arr.find((it) => it.kKonfigitem === ids[0]);
    return item ? !isNegativeOptionLabel(plainLabel(item.cName)) : false;
  }

  return ids.some((id) => {
    const item = group.oItem_arr.find((it) => it.kKonfigitem === id);
    return item ? !isNegativeOptionLabel(plainLabel(item.cName)) : false;
  });
}

type IconDef = {
  id: string;
  src: string;
  label: string;
  matchesGroup: (title: string, kg?: number) => boolean;
};

const CONFIG_OPTION_ICON_DEFS: IconDef[] = [
  {
    id: "bluetooth",
    src: "/images/bluetooth.svg",
    label: "Bluetooth",
    matchesGroup: (title, kg) =>
      kg === 29 || (/\bbluetooth\b/i.test(title) && !/position|anschluss/i.test(title)),
  },
  {
    id: "schutz-pflege",
    src: "/images/SchutzundPflege.svg",
    label: "Schutz und Pflege",
    matchesGroup: (title, kg) => {
      if (kg === 421) return true;
      const n = normalizeTitle(title);
      if (n.includes("schutzundpflege")) return true;
      if (n.includes("kantenschutz")) return true;
      return n.includes("schutz") && n.includes("pflege");
    },
  },
  {
    id: "spiegelheizung",
    src: "/images/Spiegelheizung.svg",
    label: "Spiegelheizung",
    matchesGroup: (title) =>
      /spiegelheizung/i.test(title) && !/schalter/i.test(title),
  },
  {
    id: "spiegelablage",
    src: "/images/Spiegelablage.svg",
    label: "Spiegelablage",
    matchesGroup: (title) => /spiegelablage/i.test(title),
  },
  {
    id: "uhr-wetter",
    src: "/images/UhrWetterstation.svg",
    label: "Uhr / Wetterstation",
    matchesGroup: (title) =>
      (/(uhr|wetterstation)/i.test(title) || /uhr\s*\/\s*wetter/i.test(title)) &&
      !/position|anschluss/i.test(title),
  },
  {
    id: "steckdose-vorne",
    src: "/images/Steckdosevorne.svg",
    label: "Steckdose vorne",
    matchesGroup: (title) =>
      /steckdose/i.test(title) &&
      !/position|seitlich|unten/i.test(title),
  },
  {
    id: "kosmetikspiegel",
    src: "/images/Kosmetikspiegel.svg",
    label: "Kosmetikspiegel",
    matchesGroup: (title) => isKosmetikMainGroupTitle(title),
  },
  {
    id: "garantie",
    src: "/images/garantiebis5Jahre.svg",
    label: "Garantie",
    matchesGroup: (title) => /garantie/i.test(title),
  },
  {
    id: "befestigung",
    src: "/images/Befestigung.svg",
    label: "Befestigung",
    matchesGroup: (title) =>
      /befestigung|montageset|montagel/i.test(title),
  },
];

export function resolveActiveConfigOptionIcons(
  optionGroups: ConfigGroup[],
  selections: GroupSelection[]
): ConfigOptionIcon[] {
  const active: ConfigOptionIcon[] = [];

  for (const def of CONFIG_OPTION_ICON_DEFS) {
    const groupIdx = optionGroups.findIndex((group) => {
      const title = groupTitle(group);
      if (def.matchesGroup(title, group.kKonfiggruppe)) return true;
      return false;
    });
    if (groupIdx < 0) continue;

    const group = optionGroups[groupIdx];
    const selection = selections.find((s) => s.groupIndex === groupIdx);
    if (!groupHasPositiveSelection(group, selection)) continue;

    active.push({ id: def.id, src: def.src, label: def.label });
  }

  return active;
}
