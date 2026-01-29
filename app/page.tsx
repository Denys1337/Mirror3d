"use client";

import { useState } from "react";
import MirrorScene from "../components/MirrorScene";

const MIN_MM = 400;
const MAX_MM = 2800;

export default function HomePage() {
  const [widthMm, setWidthMm] = useState(900);
  const [heightMm, setHeightMm] = useState(1600);
  const [showWall, setShowWall] = useState(true);
  const [showLight, setShowLight] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [clockCorner, setClockCorner] = useState<"top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null>(null);

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

  return (
    <main className="app-root">
      <div className="canvas-panel">
        <div className="canvas-wrapper" style={{ position: "relative" }}>
          <MirrorScene
            widthMm={widthMm}
            heightMm={heightMm}
            showWall={showWall}
            showroomLight={showLight}
            showClock={showClock}
            clockCorner={clockCorner}
            onClockCornerChange={setClockCorner}
          />
          <div className="dimension-badge">
            <span>Breite: {widthMm} mm</span>
            <span>Höhe: {heightMm} mm</span>
          </div>
        </div>
      </div>
      <div className="controls-panel">
        <h2 className="panel-title">Abmessungen</h2>
        <p className="panel-step">SCHRITT 1</p>
        <div className="config-section">
          <div className="config-row">
            <span className="config-label">Breite</span>
            <div className="slider-row">
              <span>
                {MIN_MM} – {MAX_MM}
              </span>
              <input
                type="range"
                min={MIN_MM}
                max={MAX_MM}
                value={widthMm}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setWidthMm(value);
                  const progress = ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                  e.target.style.setProperty('--slider-progress', `${progress}%`);
                }}
                onInput={(e) => {
                  const value = Number((e.target as HTMLInputElement).value);
                  const progress = ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                  (e.target as HTMLInputElement).style.setProperty('--slider-progress', `${progress}%`);
                }}
                style={{
                  ['--slider-progress' as string]: `${((widthMm - MIN_MM) / (MAX_MM - MIN_MM)) * 100}%`
                }}
              />
              <span className="dimension-value">{widthMm} mm</span>
            </div>
          </div>

          <div className="config-row">
            <span className="config-label">Höhe</span>
            <div className="slider-row">
              <span>
                {MIN_MM} – {MAX_MM}
              </span>
              <input
                type="range"
                min={MIN_MM}
                max={MAX_MM}
                value={heightMm}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setHeightMm(value);
                  const progress = ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                  e.target.style.setProperty('--slider-progress', `${progress}%`);
                }}
                onInput={(e) => {
                  const value = Number((e.target as HTMLInputElement).value);
                  const progress = ((value - MIN_MM) / (MAX_MM - MIN_MM)) * 100;
                  (e.target as HTMLInputElement).style.setProperty('--slider-progress', `${progress}%`);
                }}
                style={{
                  ['--slider-progress' as string]: `${((heightMm - MIN_MM) / (MAX_MM - MIN_MM)) * 100}%`
                }}
              />
              <span className="dimension-value">{heightMm} mm</span>
            </div>
          </div>

          <label className="toggle-row">
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
          </div>

        </div>
        <div className="price-section">
          <div className="price-label">Preis</div>
          <div className="price-value">{totalPrice.toFixed(2)} €</div>
        </div>
      </div>
    </main>
  );
}
