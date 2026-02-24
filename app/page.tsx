"use client";

import { useState, useEffect } from "react";
import MirrorScene from "../components/MirrorScene";

const MIN_MM = 400;
const MAX_MM = 2800;

export default function HomePage() {
  const [widthMm, setWidthMm] = useState(900);
  const [heightMm, setHeightMm] = useState(1600);
  const [useManualWidth, setUseManualWidth] = useState(false);
  const [useManualHeight, setUseManualHeight] = useState(false);
  const [inputWidthMm, setInputWidthMm] = useState("900");
  const [inputHeightMm, setInputHeightMm] = useState("1600");
  const [showWall, setShowWall] = useState(true);
  const [showLight, setShowLight] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [clockCorner, setClockCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);
  const [cameraView, setCameraView] = useState<"top" | "left" | "right" | "front" | undefined>(undefined);
  const [activeToolButton, setActiveToolButton] = useState<"wall" | "light" | "ruler" | "cube" | null>(null);

  // Preisberechnung
  const calculatePrice = () => {
    // Grundpreis pro Spiegelfläche (in m²)
    const areaM2 = (widthMm * heightMm) / 1000000; // Umrechnung mm² in m²
    const basePrice = areaM2 * 150; // 150 Euro pro m²
    
    // Zusätzliche Kosten für Uhr
    const clockPrice = showClock ? 45 : 0;
    
    return basePrice + clockPrice;
  };

  const totalPrice = calculatePrice();

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

  return (
    <>
      <header className="page-header">
        <div className="steps-indicator">
          <div className="step-item active">
            <div className="step-circle">1</div>
            <span className="step-label">Größe</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-circle">2</div>
            <span className="step-label">Beleuchtung</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-circle">3</div>
            <span className="step-label">Schutz und Pflege</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-circle">4</div>
            <span className="step-label">Komfort</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-circle">5</div>
            <span className="step-label">Montage</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-circle">6</div>
            <span className="step-label">Zusammenfassung</span>
          </div>
        </div>
      </header>
      <main className="app-root">
        <div className="canvas-panel">
        <div className="canvas-wrapper" style={{ position: "relative" }}>
          <MirrorScene
            widthMm={widthMm}
            heightMm={heightMm}
            showWall={activeToolButton === "wall" ? false : showWall}
            showroomLight={showLight}
            showClock={showClock}
            clockCorner={clockCorner}
            onClockCornerChange={setClockCorner}
            cameraView={cameraView}
            showDimensions={activeToolButton === "ruler"}
          />
          <div className="dimension-badge">
            <span>Breite: {widthMm} mm</span>
            <span>Höhe: {heightMm} mm</span>
          </div>
          
          <div className="tool-controls">
            <button
              className={`tool-button ${activeToolButton === "wall" ? "active" : ""}`}
              onClick={() => {
                const newActive = activeToolButton === "wall" ? null : "wall";
                setActiveToolButton(newActive);
              }}
              aria-label="Wand"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 12s4-4 11-4 11 4 11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 12s4 4 11 4 11-4 11-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button
              className={`tool-button ${activeToolButton === "light" ? "active" : ""}`}
              onClick={() => {
                const newActive = activeToolButton === "light" ? null : "light";
                setActiveToolButton(newActive);
                setShowLight(!showLight);
              }}
              aria-label="Beleuchtung"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 3v1m0 16v1M5.64 5.64l.7.7m11.32 11.32l.7.7M3 12h1m16 0h1M5.64 18.36l.7-.7m11.32-11.32l.7-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button
              className={`tool-button ${activeToolButton === "ruler" ? "active" : ""}`}
              onClick={() => {
                const newActive = activeToolButton === "ruler" ? null : "ruler";
                setActiveToolButton(newActive);
              }}
              aria-label="Lineal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="8" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 8v-2M6 16v2M9 8v-2M9 16v2M12 8v-2M12 16v2M15 8v-2M15 16v2M18 8v-2M18 16v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              className={`tool-button ${activeToolButton === "cube" ? "active" : ""}`}
              onClick={() => {
                const newActive = activeToolButton === "cube" ? null : "cube";
                setActiveToolButton(newActive);
              }}
              aria-label="3D Ansicht"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 2v20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M2 7v10M22 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="camera-controls-panel">
          <div className="camera-controls">
            <div className="camera-controls-title">Kamera Ansicht</div>
            <div className="camera-buttons">
              <button
                className="camera-button"
                onClick={() => setCameraView("top")}
                aria-label="Oben"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L8 8L12 12L16 8L12 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M12 4C12 4 6 10 6 10C6 10 6 16 6 16C6 16 12 22 12 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span>Oben</span>
              </button>
              <button
                className="camera-button"
                onClick={() => setCameraView("left")}
                aria-label="Links"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12L8 8L12 12L8 16L4 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M4 12C4 12 10 6 10 6C10 6 16 6 16 6C16 6 22 12 22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span>Links</span>
              </button>
              <button
                className="camera-button"
                onClick={() => setCameraView("right")}
                aria-label="Rechts"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 12L16 8L12 12L16 16L20 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M20 12C20 12 14 6 14 6C14 6 8 6 8 6C8 6 2 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span>Rechts</span>
              </button>
              <button
                className="camera-button"
                onClick={() => setCameraView("front")}
                aria-label="Vorne"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M4 8L6 8M4 10L5 10M20 8L18 8M20 10L19 10M4 16L6 16M4 14L5 14M20 16L18 16M20 14L19 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
                <span>Vorne</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="controls-panel">
        <div className="panel-header">
          <h2 className="panel-title">Maße</h2>
          <p className="panel-step">SCHRITT 1</p>
        </div>
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
                      min={MIN_MM}
                      max={MAX_MM}
                      value={inputWidthMm}
                      onChange={(e) => {
                        setInputWidthMm(e.target.value);
                      }}
                      onBlur={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isNaN(raw) || raw < MIN_MM) {
                          setInputWidthMm(String(widthMm));
                          return;
                        }
                        const clamped = Math.min(MAX_MM, Math.max(MIN_MM, raw));
                        setWidthMm(clamped);
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
                    Die Breite muß ab 400 und bis 2500 mm liegen. Größere Abmessungen gerne auf Anfrage.
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
                  <span>{MIN_MM} mm</span>
                  <span className="dimension-scale-current">
                    {widthMm} mm
                  </span>
                  <span>{MAX_MM} mm</span>
                </div>
                <input
                  className="dimension-slider"
                  type="range"
                  min={MIN_MM}
                  max={MAX_MM}
                  step={50}
                  value={widthMm}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setWidthMm(value);
                    const progress =
                      ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                    e.target.style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  onInput={(e) => {
                    const value = Number(
                      (e.target as HTMLInputElement).value
                    );
                    const progress =
                      ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                    (e.target as HTMLInputElement).style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  style={{
                    ["--slider-progress" as string]: `${
                      ((widthMm - MIN_MM) / (MAX_MM - MIN_MM)) * 100
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
                      min={MIN_MM}
                      max={MAX_MM}
                      value={inputHeightMm}
                      onChange={(e) => {
                        setInputHeightMm(e.target.value);
                      }}
                      onBlur={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isNaN(raw) || raw < MIN_MM) {
                          setInputHeightMm(String(heightMm));
                          return;
                        }
                        const clamped = Math.min(MAX_MM, Math.max(MIN_MM, raw));
                        setHeightMm(clamped);
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
                    Die Höhe muß ab 400 und bis 2500 mm liegen.
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
                  <span>{MIN_MM} mm</span>
                  <span className="dimension-scale-current">
                    {heightMm} mm
                  </span>
                  <span>{MAX_MM} mm</span>
                </div>
                <input
                  className="dimension-slider"
                  type="range"
                  min={MIN_MM}
                  max={MAX_MM}
                  step={50}
                  value={heightMm}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setHeightMm(value);
                    const progress =
                      ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                    e.target.style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  onInput={(e) => {
                    const value = Number(
                      (e.target as HTMLInputElement).value
                    );
                    const progress =
                      ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                    (e.target as HTMLInputElement).style.setProperty(
                      "--slider-progress",
                      `${progress}%`
                    );
                  }}
                  style={{
                    ["--slider-progress" as string]: `${
                      ((heightMm - MIN_MM) / (MAX_MM - MIN_MM)) * 100
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
        <div className="price-section">
          <div className="price-label">Gesamtpreis</div>
          <div className="price-row">
            <div className="price-value">
              {totalPrice
                .toFixed(2)
                .replace(".", ",")}{" "}
              €
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
          <button className="primary-cta-button">
            Weiter zu Beleuchtung
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
