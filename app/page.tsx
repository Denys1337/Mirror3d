"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MirrorScene from "../components/MirrorScene";
import ConfigStep, {
  type ConfigStepHandle,
  type ConfigSummaryPayload,
} from "../components/ConfigStep";
import type { ConfigOptionIcon } from "../lib/configOptionIcons";
import { resolveProductAttributesId } from "../lib/productIds";
import {
  parseProductLightingPayload,
  type ProductLightingPayload,
} from "../lib/productLighting";
import { parseMirrorUrlParams } from "../lib/urlParams";
import { resolveJtlProductPageUrlFromSearch } from "../lib/jtlShop";
import CanvasBackToProductButton from "../components/CanvasBackToProductButton";

const MIN_MM = 400;
const MAX_MM = 2800;

type LightingConfig = {
  stripWidthMm: number;
  vertSideOffsetMm: number;
  vertTopOffsetMm: number;
  vertBottomOffsetMm: number;
  horiSideOffsetMm: number;
  horiTopInsetMm: number;
  horiBottomInsetMm: number;
};

type AmbientBacklightMode =
  | "none"
  | "top"
  | "bottom"
  | "sides"
  | "top-sides"
  | "bottom-sides"
  | "top-bottom"
  | "all";

type FrontLightingMode =
  | "none"
  | "sides"
  | "top"
  | "top-bottom"
  | "top-sides"
  | "around"
  | "frame";

const SIZE_LIMITS: Record<
  string,
  { b_min: number; b_max: number; h_min: number; h_max: number }
> = {
  "1152": {
    b_min: 400,
    b_max: 2500,
    h_min: 400,
    h_max: 2500,
  },
  "1155": {
    b_min: 400,
    b_max: 2500,
    h_min: 400,
    h_max: 2500,
  },
  "1389": {
    b_min: 450,
    b_max: 1200,
    h_min: 450,
    h_max: 1200,
  },
  "1893": {
    b_min: 400,
    b_max: 2000,
    h_min: 400,
    h_max: 2000,
  },
  "1913": {
    b_min: 200,
    b_max: 2500,
    h_min: 200,
    h_max: 2500,
  },
  "1948": {
    b_min: 300,
    b_max: 2000,
    h_min: 300,
    h_max: 2500,
  },
  "2129": {
    b_min: 100,
    b_max: 2500,
    h_min: 100,
    h_max: 2500,
  },
  "2130": {
    b_min: 100,
    b_max: 2500,
    h_min: 100,
    h_max: 2500,
  },
  "2435": {
    b_min: 300,
    b_max: 2000,
    h_min: 300,
    h_max: 2500,
  },
  "2470": {
    b_min: 300,
    b_max: 1000,
    h_min: 300,
    h_max: 1000,
  },
  "2546": {
    b_min: 600,
    b_max: 1000,
    h_min: 600,
    h_max: 1000,
  },
};

type SizeLimits = {
  b_min: number;
  b_max: number;
  h_min: number;
  h_max: number;
};

function resolveSizeLimits(mirrorSize: string | null): SizeLimits {
  if (mirrorSize && SIZE_LIMITS[mirrorSize]) {
    return SIZE_LIMITS[mirrorSize];
  }
  return {
    b_min: MIN_MM,
    b_max: MAX_MM,
    h_min: MIN_MM,
    h_max: MAX_MM,
  };
}

function HomePageContent() {
  const searchParams = useSearchParams();

  // URL: id=kArtikel, n=artical_number, s=size (kKonfigitem), t=token, sid=session
  const urlParams = parseMirrorUrlParams(searchParams);
  const productPageUrl = useMemo(
    () => resolveJtlProductPageUrlFromSearch(searchParams),
    [searchParams]
  );
  const mirrorIdFromUrl = urlParams.artikelId;
  const mirrorArticalFromUrl = urlParams.articalNumber;
  const mirrorSizeFromUrl = urlParams.sizeKonfigItem;
  const initialSizeLimits = resolveSizeLimits(mirrorSizeFromUrl);

  const [mirrorId, setMirrorId] = useState<string | null>(null);
  const [mirrorSize, setMirrorSize] = useState<string | null>(null);

  const [widthMm, setWidthMm] = useState(initialSizeLimits.b_min);
  const [heightMm, setHeightMm] = useState(initialSizeLimits.h_min);
  // Розміри, які відправляємо в JTL (commit only: slider mouse up / input blur)
  const [committedWidthMm, setCommittedWidthMm] = useState(initialSizeLimits.b_min);
  const [committedHeightMm, setCommittedHeightMm] = useState(initialSizeLimits.h_min);
  const [useManualWidth, setUseManualWidth] = useState(false);
  const [useManualHeight, setUseManualHeight] = useState(false);
  const [inputWidthMm, setInputWidthMm] = useState(String(initialSizeLimits.b_min));
  const [inputHeightMm, setInputHeightMm] = useState(String(initialSizeLimits.h_min));
  const [showWall, setShowWall] = useState(true);
  const [showClock, setShowClock] = useState(false);
  const [clockCorner, setClockCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);
  const [showSocket, setShowSocket] = useState(false);
  const [socketCorner, setSocketCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);
  const [showTouchSensor, setShowTouchSensor] = useState(false);
  const [touchSensorCorner, setTouchSensorCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);
  const [showSchminkspiegel, setShowSchminkspiegel] = useState(false);
  const [schminkspiegelCorner, setSchminkspiegelCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);
  const [cameraView, setCameraView] = useState<"top" | "left" | "right" | "front" | undefined>(undefined);
  const [wallToolActive, setWallToolActive] = useState(true);
  const [lightToolActive, setLightToolActive] = useState(true);
  const [rulerToolActive, setRulerToolActive] = useState(true);
  const [lightingMode, setLightingMode] = useState<FrontLightingMode>("sides");
  const [lightTemperatureK, setLightTemperatureK] = useState(4000);
  const [ambientBacklightMode, setAmbientBacklightMode] =
    useState<AmbientBacklightMode>("none");
  const [lightingConfig, setLightingConfig] = useState<LightingConfig>({
    stripWidthMm: 30,
    vertSideOffsetMm: 40,
    vertTopOffsetMm: 60,
    vertBottomOffsetMm: 60,
    horiSideOffsetMm: 0,
    horiTopInsetMm: 0,
    horiBottomInsetMm: 0,
  });
  const [productLightingPayload, setProductLightingPayload] =
    useState<ProductLightingPayload | null>(null);
  const [showShelf, setShowShelf] = useState(false);
  const [shelfLengthMm, setShelfLengthMm] = useState(800);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [jtlSumm, setJtlSumm] = useState<number | null>(null);
  const [configSummary, setConfigSummary] = useState<ConfigSummaryPayload | null>(
    null
  );
  const [manufacturerName, setManufacturerName] = useState<string | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [konfigComment, setKonfigComment] = useState("");
  const [activeOptionIcons, setActiveOptionIcons] = useState<ConfigOptionIcon[]>(
    []
  );
  const configStepRef = useRef<ConfigStepHandle>(null);

  // Після reload дані конфігу обнуляються — завжди починаємо з кроку 1.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("mirror3d-active-step");
  }, []);

  const sizeLimits = useMemo(
    () => resolveSizeLimits(mirrorSizeFromUrl),
    [mirrorSizeFromUrl]
  );

  // Ініціалізуємо глобальну конфігурацію з URL (для сумісності з іншими скриптами)
  useEffect(() => {
    if (mirrorIdFromUrl || mirrorSizeFromUrl) {
      setMirrorId(mirrorIdFromUrl);
      setMirrorSize(mirrorSizeFromUrl);

      if (typeof window !== "undefined") {
        (window as any).mirrorConfig = (window as any).mirrorConfig || {};
        if (mirrorIdFromUrl) (window as any).mirrorConfig.id = mirrorIdFromUrl;
        if (mirrorSizeFromUrl)
          (window as any).mirrorConfig.size = mirrorSizeFromUrl;
        // Для дебага
        console.log("mirrorConfig from URL:", (window as any).mirrorConfig);
      }
    }
  }, [mirrorIdFromUrl, mirrorSizeFromUrl]);

  useEffect(() => {
    const productId = resolveProductAttributesId(
      mirrorIdFromUrl,
      mirrorArticalFromUrl
    );

    const parseMm = (value: unknown, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    const mapLightingMode = (strType: unknown): FrontLightingMode => {
      const value = String(strType || "").toLowerCase();
      if (value === "xnolight") return "none";
      if (value === "xside") return "sides";
      if (value === "xtop") return "top";
      if (value === "xtopdown") return "top-bottom";
      if (value === "xtopside") return "top-sides";
      if (value === "xaround") return "around";
      // legacy payload support
      if (value === "xframe") return "frame";
      return "sides";
    };

    const loadProductAttributes = async () => {
      try {
        const res = await fetch(`/api/product-attributes/${productId}`);
        if (!res.ok) {
          setProductLightingPayload(null);
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const parsed = parseProductLightingPayload(data);
        if (!parsed) {
          console.warn("product-attributes: incomplete JSON", productId);
          setProductLightingPayload(null);
          return;
        }

        setProductLightingPayload(parsed);
        setLightingMode(mapLightingMode(parsed.str_type));
        setLightingConfig({
          stripWidthMm: parseMm(parsed.str_widt, 30),
          vertSideOffsetMm: parseMm(parsed.str_vert_bside, 40),
          vertTopOffsetMm: parseMm(parsed.str_vert_top, 60),
          vertBottomOffsetMm: parseMm(parsed.str_vert_btm, 60),
          horiSideOffsetMm: parseMm(parsed.str_hori_bside, 0),
          horiTopInsetMm: parseMm(parsed.str_hori_top, 0),
          horiBottomInsetMm: parseMm(parsed.str_hori_btm, 0),
        });
      } catch (error) {
        setProductLightingPayload(null);
        console.warn("Failed to load product attributes", error);
      }
    };

    loadProductAttributes();
  }, [mirrorIdFromUrl, mirrorArticalFromUrl]);

  useEffect(() => {
    if (manufacturerName) return;
    const id = (mirrorIdFromUrl || "").trim();
    if (!id) return;
    let cancelled = false;

    const loadManufacturerFallback = async () => {
      try {
        const res = await fetch(`/api/product-manufacturer?id=${id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { manufacturer?: string | null };
        const value = (data.manufacturer || "").trim();
        if (!cancelled && value) {
          setManufacturerName(value);
        }
      } catch {
        // ignore fallback failures
      }
    };

    void loadManufacturerFallback();
    return () => {
      cancelled = true;
    };
  }, [manufacturerName, mirrorIdFromUrl]);

  // Preisberechnung
  const calculatePrice = () => {
    // Grundpreis pro Spiegelfläche (in m²)
    const areaM2 = (widthMm * heightMm) / 1000000; // Umrechnung mm² in m²
    const basePrice = areaM2 * 150; // 150 Euro pro m²
    
    // Zusätzliche Kosten für Uhr
    const clockPrice = showClock ? 45 : 0;
    
    return basePrice + clockPrice;
  };

  // Синхронізуємо значення інпутів зі значеннями слайдерів
  useEffect(() => {
    if (!useManualWidth) {
      setInputWidthMm(String(widthMm));
    }
  }, [widthMm, useManualWidth]);

  useEffect(() => {
    if (!useManualHeight) {
      setInputHeightMm(String(heightMm));
    }
  }, [heightMm, useManualHeight]);

  // Оновлюємо значення інпутів при перемиканні на ручний режим
  useEffect(() => {
    if (useManualWidth) {
      setInputWidthMm(String(widthMm));
    }
  }, [useManualWidth]);

  useEffect(() => {
    if (useManualHeight) {
      setInputHeightMm(String(heightMm));
    }
  }, [useManualHeight]);

  // Клэмпимо поточну ширину/висоту під актуальні ліміти
  useEffect(() => {
    setWidthMm((prev) =>
      Math.min(sizeLimits.b_max, Math.max(sizeLimits.b_min, prev))
    );
    setHeightMm((prev) =>
      Math.min(sizeLimits.h_max, Math.max(sizeLimits.h_min, prev))
    );
    setCommittedWidthMm((prev) =>
      Math.min(sizeLimits.b_max, Math.max(sizeLimits.b_min, prev))
    );
    setCommittedHeightMm((prev) =>
      Math.min(sizeLimits.h_max, Math.max(sizeLimits.h_min, prev))
    );
  }, [sizeLimits.b_min, sizeLimits.b_max, sizeLimits.h_min, sizeLimits.h_max]);

  return (
    <>
      <header className="page-header">
        <div className="steps-indicator">
          <div
            className={`step-item ${activeStep === 1 ? "active" : ""}`}
            onClick={() => setActiveStep(1)}
          >
            <div className="step-circle">1</div>
            <span className="step-label">Größe</span>
          </div>
          <div className="step-connector"></div>
          <div
            className={`step-item ${activeStep === 2 ? "active" : ""}`}
            onClick={() => setActiveStep(2)}
          >
            <div className="step-circle">2</div>
            <span className="step-label">Beleuchtung</span>
          </div>
          <div className="step-connector"></div>
          <div
            className={`step-item ${activeStep === 3 ? "active" : ""}`}
            onClick={() => setActiveStep(3)}
          >
            <div className="step-circle">3</div>
            <span className="step-label">Zubehör</span>
          </div>
          <div className="step-connector"></div>
          <div
            className={`step-item ${activeStep === 4 ? "active" : ""}`}
            onClick={() => setActiveStep(4)}
          >
            <div className="step-circle">4</div>
            <span className="step-label">Montage</span>
          </div>
          <div className="step-connector"></div>
          <div
            className={`step-item ${activeStep === 5 ? "active" : ""}`}
            onClick={() => setActiveStep(5)}
          >
            <div className="step-circle">5</div>
            <span className="step-label">Zusammenfassung</span>
          </div>
        </div>
      </header>
      <main className="app-root">
        <div className="canvas-panel">
        <div className="canvas-wrapper" style={{ position: "relative" }}>
          <CanvasBackToProductButton href={productPageUrl} />
          <MirrorScene
            widthMm={widthMm}
            heightMm={heightMm}
            showWall={wallToolActive}
            showroomLight={lightToolActive}
            showClock={showClock}
            clockCorner={clockCorner}
            onClockCornerChange={setClockCorner}
            showSocket={showSocket}
            socketCorner={socketCorner}
            onSocketCornerChange={setSocketCorner}
            showTouchSensor={showTouchSensor}
            touchSensorCorner={touchSensorCorner}
            onTouchSensorCornerChange={setTouchSensorCorner}
            showSchminkspiegel={showSchminkspiegel}
            schminkspiegelCorner={schminkspiegelCorner}
            onSchminkspiegelCornerChange={setSchminkspiegelCorner}
            cameraView={cameraView}
            showDimensions={rulerToolActive}
            lightingMode={lightingMode}
            lightingConfig={lightingConfig}
            lightTemperatureK={lightTemperatureK}
            ambientBacklightMode={ambientBacklightMode}
            showShelf={showShelf}
            shelfLengthMm={shelfLengthMm}
          />
          <div className="canvas-tool-column">
          <div className="tool-controls">
            <button
              className={`tool-button ${wallToolActive ? "active" : ""}`}
              onClick={() => {
                setWallToolActive((prev) => !prev);
              }}
              aria-label="Wand"
              title={wallToolActive ? "Wand aus" : "Wand ein"}
            >
              <img className="tool-button-icon" src="/images/wall.svg" alt="" aria-hidden="true" />
              <span className="tool-button-tooltip">
                {wallToolActive ? "Wand aus" : "Wand ein"}
              </span>
            </button>
            <button
              className={`tool-button ${lightToolActive ? "active" : ""}`}
              onClick={() => {
                setLightToolActive((prev) => !prev);
              }}
              aria-label="Beleuchtung"
              title={lightToolActive ? "Licht aus" : "Licht ein"}
            >
              <img className="tool-button-icon" src="/images/light.svg" alt="" aria-hidden="true" />
              <span className="tool-button-tooltip">
                {lightToolActive ? "Licht aus" : "Licht ein"}
              </span>
            </button>
            <button
              className={`tool-button ${rulerToolActive ? "active" : ""}`}
              onClick={() => {
                setRulerToolActive((prev) => !prev);
              }}
              aria-label="Lineal"
              title={rulerToolActive ? "Bemarkungen ausblenden" : "Bemarkungen einblenden"}
            >
              <img className="tool-button-icon" src="/images/size.svg" alt="" aria-hidden="true" />
              <span className="tool-button-tooltip">
                {rulerToolActive ? "Bemarkungen ausblenden" : "Bemarkungen einblenden"}
              </span>
            </button>
          </div>
          {activeOptionIcons.length > 0 ? (
            <div className="tool-option-icons" aria-label="Gewählte Optionen">
              {activeOptionIcons.map((icon) => (
                <div
                  key={icon.id}
                  className="tool-option-icon-wrap"
                  aria-label={icon.label}
                >
                  <img
                    className="tool-option-icon"
                    src={icon.src}
                    alt=""
                    aria-hidden="true"
                  />
                  <span className="tool-button-tooltip">{icon.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          </div>
          <div className="camera-overlay-controls">
            <div className="camera-overlay-title">
              <span>KAMERA</span>
              <span>ANSICHT</span>
            </div>
            <div className="camera-overlay-buttons">
              <button
                className={`camera-overlay-button ${cameraView === "top" ? "active" : ""}`}
                onClick={() => setCameraView("top")}
                aria-label="Oben"
                type="button"
              >
                <img className="camera-overlay-icon" src="/images/oben.svg" alt="" aria-hidden="true" />
                <span>Oben</span>
              </button>
              <button
                className={`camera-overlay-button ${cameraView === "left" ? "active" : ""}`}
                onClick={() => setCameraView("left")}
                aria-label="Links"
                type="button"
              >
                <img className="camera-overlay-icon" src="/images/links.svg" alt="" aria-hidden="true" />
                <span>Links</span>
              </button>
              <button
                className={`camera-overlay-button ${cameraView === "right" ? "active" : ""}`}
                onClick={() => setCameraView("right")}
                aria-label="Rechts"
                type="button"
              >
                <img className="camera-overlay-icon" src="/images/Rechts.svg" alt="" aria-hidden="true" />
                <span>Rechts</span>
              </button>
              <button
                className={`camera-overlay-button ${cameraView === "front" ? "active" : ""}`}
                onClick={() => setCameraView("front")}
                aria-label="Vorne"
                type="button"
              >
                <img className="camera-overlay-icon" src="/images/Vorne.svg" alt="" aria-hidden="true" />
                <span>Vorne</span>
              </button>
            </div>
          </div>
        </div>
        {/* <div className="lighting-select-panel">
          <div className="lighting-select-title">Beleuchtung auf dem Spiegel</div>
          <select
            className="lighting-select"
            value={lightingMode}
            onChange={(e) =>
              setLightingMode(e.target.value as "none" | "sides" | "frame" | "top-sides")
            }
          >
            <option value="none">Keine Beleuchtung</option>
            <option value="sides">Seitliche Streifen</option>
            <option value="frame">Rahmen oben + Seiten</option>
            <option value="top-sides">Oben + Seiten</option>
          </select>
          <label className="lighting-shelf-row">
            <input
              type="checkbox"
              checked={showShelf}
              onChange={(e) => setShowShelf(e.target.checked)}
            />
            <span>Glasablage anzeigen</span>
          </label>
          {showShelf && (
            <div className="shelf-width-control">
              <div className="shelf-width-scale">
                <span>
                  Min {500} mm
                </span>
                <span className="dimension-scale-current">
                  {shelfLengthMm}{" "}
                  mm
                </span>
                <span>
                  Max {Math.max(widthMm - 160, 500)} mm
                </span>
              </div>
              <input
                className="shelf-width-slider"
                type="range"
                min={500}
                max={Math.max(widthMm - 160, 500)}
                step={10}
                value={shelfLengthMm}
                onChange={(e) => setShelfLengthMm(Number(e.target.value))}
              />
            </div>
          )}
          <label className="lighting-shelf-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={showSocket}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowSocket(checked);
                if (checked) {
                  setSocketCorner(null);
                }
              }}
            />
            <span>Steckdose anzeigen</span>
          </label>
          {showSocket && (
            <select
              className="lighting-select"
              style={{ marginTop: 8 }}
              value={socketCorner || ""}
              onChange={(e) =>
                setSocketCorner(
                  e.target.value === ""
                    ? null
                    : (e.target.value as
                        | "top-left"
                        | "top-center"
                        | "top-right"
                        | "right-center"
                        | "bottom-right"
                        | "bottom-center"
                        | "bottom-left"
                        | "left-center")
                )
              }
            >
              <option value="">Mitte (Auswahl mit Kreis)</option>
              <option value="top-left">Oben links</option>
              <option value="top-center">Oben Mitte</option>
              <option value="top-right">Oben rechts</option>
              <option value="right-center">Rechts Mitte</option>
              <option value="bottom-right">Unten rechts</option>
              <option value="bottom-center">Unten Mitte</option>
              <option value="bottom-left">Unten links</option>
              <option value="left-center">Links Mitte</option>
            </select>
          )}
          <label className="lighting-shelf-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={showTouchSensor}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowTouchSensor(checked);
                if (checked) {
                  setTouchSensorCorner(null);
                }
              }}
            />
            <span>Touch-Sensor anzeigen</span>
          </label>
          {showTouchSensor && (
            <select
              className="lighting-select"
              style={{ marginTop: 8 }}
              value={touchSensorCorner || ""}
              onChange={(e) =>
                setTouchSensorCorner(
                  e.target.value === ""
                    ? null
                    : (e.target.value as
                        | "top-left"
                        | "top-center"
                        | "top-right"
                        | "right-center"
                        | "bottom-right"
                        | "bottom-center"
                        | "bottom-left"
                        | "left-center")
                )
              }
            >
              <option value="">Mitte (Auswahl mit Kreis)</option>
              <option value="top-left">Oben links</option>
              <option value="top-center">Oben Mitte</option>
              <option value="top-right">Oben rechts</option>
              <option value="right-center">Rechts Mitte</option>
              <option value="bottom-right">Unten rechts</option>
              <option value="bottom-center">Unten Mitte</option>
              <option value="bottom-left">Unten links</option>
              <option value="left-center">Links Mitte</option>
            </select>
          )}
          <label className="lighting-shelf-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={showSchminkspiegel}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowSchminkspiegel(checked);
                if (checked) {
                  setSchminkspiegelCorner(null);
                }
              }}
            />
            <span>Schminkspiegel anzeigen</span>
          </label>
          {showSchminkspiegel && (
            <select
              className="lighting-select"
              style={{ marginTop: 8 }}
              value={schminkspiegelCorner || ""}
              onChange={(e) =>
                setSchminkspiegelCorner(
                  e.target.value === ""
                    ? null
                    : (e.target.value as
                        | "top-left"
                        | "top-center"
                        | "top-right"
                        | "right-center"
                        | "bottom-right"
                        | "bottom-center"
                        | "bottom-left"
                        | "left-center")
                )
              }
            >
              <option value="">Mitte (Auswahl mit Kreis)</option>
              <option value="top-left">Oben links</option>
              <option value="top-center">Oben Mitte</option>
              <option value="top-right">Oben rechts</option>
              <option value="right-center">Rechts Mitte</option>
              <option value="bottom-right">Unten rechts</option>
              <option value="bottom-center">Unten Mitte</option>
              <option value="bottom-left">Unten links</option>
              <option value="left-center">Links Mitte</option>
            </select>
          )}
        </div> */}
      </div>
      
      <div className="controls-panel">
        <div className="panel-header">
          <h2 className="panel-title">
            {activeStep === 1
              ? "Maße"
              : activeStep === 2
                ? "Beleuchtung"
                : activeStep === 3
                  ? "Zubehör"
                  : activeStep === 4
                    ? "Montage"
                    : "Zusammenfassung"}
          </h2>
          <p className="panel-step">SCHRITT {activeStep}</p>
        </div>

        {activeStep === 1 && (
        <div className="config-section">
          {/* Breite */}
          <div className="dimension-group">
            <div className="dimension-header">
              <span className="info-icon">i</span>
              <span className="dimension-label">Breite</span>
            </div>
            {useManualWidth ? (
              <>
                <div className="dimension-manual-row">
                  <div className="dimension-manual-input-wrapper">
                    <input
                      type="number"
                      className="dimension-manual-input"
                      min={sizeLimits.b_min}
                      max={sizeLimits.b_max}
                      value={inputWidthMm}
                      onChange={(e) => {
                        setInputWidthMm(e.target.value);
                      }}
                      onBlur={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isNaN(raw) || raw < sizeLimits.b_min) {
                          setInputWidthMm(String(widthMm));
                          return;
                        }
                        const clamped = Math.min(
                          sizeLimits.b_max,
                          Math.max(sizeLimits.b_min, raw)
                        );
                        setWidthMm(clamped);
                        setCommittedWidthMm(clamped);
                        setInputWidthMm(String(clamped));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="dimension-manual-unit">mm</span>
                  </div>
                  <div className="dimension-manual-info">
                    Die Breite muß ab {sizeLimits.b_min} und bis{" "}
                    {sizeLimits.b_max} mm liegen. Größere Abmessungen gerne auf
                    Anfrage.
                  </div>
                </div>
                <button
                  type="button"
                  className="dimension-toggle-button"
                  onClick={() => setUseManualWidth(false)}
                >
                  <span className="dimension-toggle-icon" aria-hidden="true">
                    <img src="/images/setting.svg" alt="" />
                  </span>
                  <span className="dimension-toggle-text">Schieberegler</span>
                </button>
              </>
            ) : (
              <>
                <div className="dimension-scale">
                  <span>{sizeLimits.b_min} mm</span>
                  <span className="dimension-scale-current">
                    {widthMm} mm
                  </span>
                  <span>{sizeLimits.b_max} mm</span>
                </div>
                <input
                  className="dimension-slider"
                  type="range"
                  min={sizeLimits.b_min}
                  max={sizeLimits.b_max}
                  step={10}
                  value={widthMm}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setWidthMm(value);
                    const progress =
                      ((value - sizeLimits.b_min) /
                        (sizeLimits.b_max - sizeLimits.b_min)) *
                      100;
                    e.target.style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  onMouseUp={(e) => {
                    if (e.button !== 0) return;
                    setCommittedWidthMm(Number((e.target as HTMLInputElement).value));
                  }}
                  onTouchEnd={(e) => {
                    setCommittedWidthMm(Number((e.target as HTMLInputElement).value));
                  }}
                  onInput={(e) => {
                    const value = Number(
                      (e.target as HTMLInputElement).value
                    );
                    const progress =
                      ((value - sizeLimits.b_min) /
                        (sizeLimits.b_max - sizeLimits.b_min)) *
                      100;
                    (e.target as HTMLInputElement).style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  style={{
                    ["--slider-progress" as string]: `${
                      ((widthMm - sizeLimits.b_min) /
                        (sizeLimits.b_max - sizeLimits.b_min)) *
                      100
                    }%`,
                  }}
                />
                <button
                  type="button"
                  className="dimension-input-button"
                  onClick={() => setUseManualWidth(true)}
                >
                  <span className="dimension-input-icon" aria-hidden="true">
                    <img src="/images/pen.svg" alt="" />
                  </span>
                  <span className="dimension-input-text">
                    Eigenen Wert eingeben
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Höhe */}
          <div className="dimension-group">
            <div className="dimension-header">
              <span className="info-icon">i</span>
              <span className="dimension-label">Höhe</span>
            </div>
            {useManualHeight ? (
              <>
                <div className="dimension-manual-row">
                  <div className="dimension-manual-input-wrapper">
                    <input
                      type="number"
                      className="dimension-manual-input"
                      min={sizeLimits.h_min}
                      max={sizeLimits.h_max}
                      value={inputHeightMm}
                      onChange={(e) => {
                        setInputHeightMm(e.target.value);
                      }}
                      onBlur={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isNaN(raw) || raw < sizeLimits.h_min) {
                          setInputHeightMm(String(heightMm));
                          return;
                        }
                        const clamped = Math.min(
                          sizeLimits.h_max,
                          Math.max(sizeLimits.h_min, raw)
                        );
                        setHeightMm(clamped);
                        setCommittedHeightMm(clamped);
                        setInputHeightMm(String(clamped));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="dimension-manual-unit">mm</span>
                  </div>
                  <div className="dimension-manual-info">
                    Die Höhe muß ab {sizeLimits.h_min} und bis{" "}
                    {sizeLimits.h_max} mm liegen.
                    <br />
                    Größere Abmessungen gerne auf Anfrage.
                  </div>
                </div>
                <button
                  type="button"
                  className="dimension-toggle-button"
                  onClick={() => setUseManualHeight(false)}
                >
                  <span className="dimension-toggle-icon" aria-hidden="true">
                    <img src="/images/setting.svg" alt="" />
                  </span>
                  <span className="dimension-toggle-text">Schieberegler</span>
                </button>
              </>
            ) : (
              <>
                <div className="dimension-scale">
                  <span>{sizeLimits.h_min} mm</span>
                  <span className="dimension-scale-current">
                    {heightMm} mm
                  </span>
                  <span>{sizeLimits.h_max} mm</span>
                </div>
                <input
                  className="dimension-slider"
                  type="range"
                  min={sizeLimits.h_min}
                  max={sizeLimits.h_max}
                  step={10}
                  value={heightMm}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setHeightMm(value);
                    const progress =
                      ((value - sizeLimits.h_min) /
                        (sizeLimits.h_max - sizeLimits.h_min)) *
                      100;
                    e.target.style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  onMouseUp={(e) => {
                    if (e.button !== 0) return;
                    setCommittedHeightMm(Number((e.target as HTMLInputElement).value));
                  }}
                  onTouchEnd={(e) => {
                    setCommittedHeightMm(Number((e.target as HTMLInputElement).value));
                  }}
                  onInput={(e) => {
                    const value = Number(
                      (e.target as HTMLInputElement).value
                    );
                    const progress =
                      ((value - sizeLimits.h_min) /
                        (sizeLimits.h_max - sizeLimits.h_min)) *
                      100;
                    (e.target as HTMLInputElement).style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  style={{
                    ["--slider-progress" as string]: `${
                      ((heightMm - sizeLimits.h_min) /
                        (sizeLimits.h_max - sizeLimits.h_min)) *
                      100
                    }%`,
                  }}
                />
                <button
                  type="button"
                  className="dimension-input-button"
                  onClick={() => setUseManualHeight(true)}
                >
                  <span className="dimension-input-icon" aria-hidden="true">
                    <img src="/images/pen.svg" alt="" />
                  </span>
                  <span className="dimension-input-text">
                    Eigenen Wert eingeben
                  </span>
                </button>
              </>
            )}
          </div>

          {/* <label className="toggle-row">
            <input
              type="checkbox"
              checked={showWall}
              onChange={(e) => setShowWall(e.target.checked)}
            />
            <span>Wand anzeigen</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showLight}
              onChange={(e) => setShowLight(e.target.checked)}
            />
            <span>Beleuchtung um den Spiegel</span>
          </label>

          <div className="toggle-with-select">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showClock}
                onChange={(e) => {
                  setShowClock(e.target.checked);
                  // Position auf null zurücksetzen beim Ausschalten der Uhr
                  if (!e.target.checked) {
                    setClockCorner(null);
                  }
                }}
              />
              <span>Uhr anzeigen</span>
            </label>

            {showClock && (
              <div className="select-nested">
                <select
                  value={clockCorner || ""}
                  onChange={(e) => setClockCorner(e.target.value === "" ? null : e.target.value as "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center")}
                  className="custom-select nested-select"
                >
                  <option value="">Mitte (Auswahl mit Kreis)</option>
                  <option value="top-left">Oben links</option>
                  <option value="top-center">Oben Mitte</option>
                  <option value="top-right">Oben rechts</option>
                  <option value="right-center">Rechts Mitte</option>
                  <option value="bottom-right">Unten rechts</option>
                  <option value="bottom-center">Unten Mitte</option>
                  <option value="bottom-left">Unten links</option>
                  <option value="left-center">Links Mitte</option>
                </select>
              </div>
            )}
          </div> */}

        </div>
        )}

        <div
          style={{ display: activeStep >= 2 && activeStep <= 4 ? "block" : "none" }}
          aria-hidden={!(activeStep >= 2 && activeStep <= 4)}
        >
          <ConfigStep
            ref={configStepRef}
            widthMm={committedWidthMm}
            heightMm={committedHeightMm}
            onSummChange={setJtlSumm}
            onSummaryChange={setConfigSummary}
            onManufacturerChange={setManufacturerName}
            onLightTemperatureChange={setLightTemperatureK}
            onAmbientBacklightChange={setAmbientBacklightMode}
            onOptionIconsChange={setActiveOptionIcons}
            activeStep={activeStep}
            productLightingPayload={productLightingPayload}
          />
        </div>

        {activeStep === 5 && (
          <section className="config-summary-box">
            <p className="config-summary-meta">
              <strong>Artikelnummer:</strong> {mirrorArticalFromUrl || "—"}
            </p>
            {/* <p className="config-summary-meta">
              <strong>Hersteller:</strong> {manufacturerName || "—"}
            </p> */}
            <ul className="config-summary-list">
              <li>
                {`1x ${configSummary?.widthMm ?? committedWidthMm} x ${
                  configSummary?.heightMm ?? committedHeightMm
                } mm BxH » 0,00 € Stückpreis`}
              </li>
              {(configSummary?.lines ?? []).map((line, idx) => (
                <li key={`${idx}-${line.label}`}>
                  {`1x ${line.label} » ${line.price} Stückpreis`}
                </li>
              ))}
            </ul>
            <textarea
              className="config-konfig-comment"
              rows={4}
              value={konfigComment}
              onChange={(e) => setKonfigComment(e.target.value)}
              placeholder="Hinterlasse uns ein Kommentar zu dieser Konfiguration"
            />
          </section>
        )}

        <div className="price-section">
          <div className="price-label">Gesamtpreis</div>
          <div className="price-row">
            <div className="price-value">
              {jtlSumm == null ? (
                "—"
              ) : (
                <>
                  {jtlSumm.toFixed(2).replace(".", ",")} €
                </>
              )}
            </div>
            <div className="price-delivery-info">
              <span className="price-delivery-text">
                <span className="price-delivery-label">Lieferzeit:</span> 3-5 Werktage
              </span>
              <div className="price-badges">
                <span className="price-badge">zzgl. Versand</span>
                <span className="price-badge">inkl. 19%Ust.</span>
              </div>
            </div>
          </div>
          {cartError ? (
            <p className="text-danger small mb-2" role="alert">
              {cartError}
            </p>
          ) : null}
          <button
            className="primary-cta-button"
            type="button"
            disabled={cartLoading}
            onClick={async () => {
              if (activeStep < 5) {
                setActiveStep((prev) => prev + 1);
                return;
              }
              setCartError(null);
              setCartLoading(true);
              try {
                await configStepRef.current?.addToCart(konfigComment);
              } catch (e) {
                const msg =
                  e instanceof Error ? e.message : "Warenkorb fehlgeschlagen";
                setCartError(msg);
                console.error("addToCart", e);
              } finally {
                setCartLoading(false);
              }
            }}
          >
            {cartLoading
              ? "Wird hinzugefügt…"
              : activeStep === 5
                ? "In den Warenkorb"
                : "Weiter"}
            <span className="primary-cta-arrow">
              <img src="/images/arrowButton.svg" alt="" />
            </span>
          </button>
        </div>
      </div>
      </main>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
