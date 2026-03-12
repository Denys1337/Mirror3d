"use client";

import { useEffect, useMemo, useState } from "react";

type RawResponse = {
  oKonfig_arr: RawConfigGroup[];
};

type RawConfigGroup = {
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
  cName: string;
  cBeschreibung?: string | null;
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
};

/**
 * Step 2: Konfiguration der Optionen aus der ursprünglichen JTL-Konfiguration (artikel.js / sdfsd.json).
 * Liest die Gruppen aus sdfsd.json und rendert sie als Selects / Checkboxen.
 */
export default function ConfigStep({ onSelectionChange }: Props) {
  const [configGroups, setConfigGroups] = useState<RawConfigGroup[]>([]);

  // Витягуємо response.oKonfig_arr через API, щоб не імпортувати великий JSON напряму
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const res = await fetch("/api/config");
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

  // Пропускаємо першу групу "Spiegelmaß" (розміри), бо її вже конфігуруємо в Step 1
  const optionGroups = useMemo(
    () =>
      configGroups.filter(
        (group, index) =>
          index !== 0 && group.oItem_arr && group.oItem_arr.length > 0
      ),
    [configGroups]
  );

  const [selections, setSelections] = useState<GroupSelection[]>([]);

  // Ініціалізуємо вибір, коли зʼявляються групи
  useEffect(() => {
    if (optionGroups.length === 0) return;
    setSelections(
      optionGroups.map((group, index) => {
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
      })
    );
  }, [optionGroups]);

  const handleSingleSelectChange = (groupIdx: number, itemId: number) => {
    setSelections((prev) => {
      const next = prev.map((g) =>
        g.groupIndex === groupIdx
          ? { ...g, selectedItemIds: itemId ? [itemId] : [] }
          : g
      );
      onSelectionChange?.(next);
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
      return next;
    });
  };

  if (configGroups.length === 0) {
    return (
      <section className="config-step-2">
        <div className="config-section">
          <div className="dimension-group">
            <div className="dimension-manual-info">
              Konfigurationsdaten werden geladen...
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="config-step-2">
      <div className="config-section">
        {optionGroups.map((group, idx) => {
          const selection = selections.find((s) => s.groupIndex === idx);
          const selectedIds = selection?.selectedItemIds ?? [];
          const isSingleChoice = group.nMax === 1;
          const title = group.oSprache?.cName ?? group.cKommentar ?? "";
          const description = group.oSprache?.cBeschreibung ?? "";

          return (
            <div className="dimension-group" key={idx}>
              <div className="dimension-header">
                <span className="info-icon">i</span>
                <span className="dimension-label">{title}</span>
              </div>
              {description && (
                <div
                  className="dimension-manual-info"
                  style={{ marginBottom: 8 }}
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}

              {isSingleChoice ? (
                <div className="dimension-manual-row">
                  <div className="dimension-manual-input-wrapper">
                    <select
                      className="dimension-manual-input"
                      value={selectedIds[0] ?? ""}
                      onChange={(e) =>
                        handleSingleSelectChange(
                          idx,
                          e.target.value ? Number(e.target.value) : 0
                        )
                      }
                    >
                      <option value="">Bitte wählen</option>
                      {group.oItem_arr.map((item) => (
                        <option key={item.kKonfigitem} value={item.kKonfigitem}>
                          {item.cName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="dimension-manual-row">
                  <div className="dimension-manual-input-wrapper">
                    <div className="options-multiselect">
                      {group.oItem_arr.map((item) => {
                        const checked = selectedIds.includes(
                          item.kKonfigitem
                        );
                        return (
                          <label
                            key={item.kKonfigitem}
                            className="lighting-shelf-row"
                            style={{ marginTop: 4 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleMultiToggle(idx, item.kKonfigitem)
                              }
                            />
                            <span>{item.cName}</span>
                          </label>
                        );
                      })}
                    </div>
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

