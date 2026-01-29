"use client";

import { useState } from "react";
import MirrorScene from "./MirrorScene";

const MIN_MM = 400;
const MAX_MM = 2800;

export default function MirrorConfigurator({ showControls = false }: { showControls?: boolean }) {
  const [widthMm, setWidthMm] = useState(900);
  const [heightMm, setHeightMm] = useState(1600);
  const [showWall, setShowWall] = useState(true);
  const [showLight, setShowLight] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [clockCorner, setClockCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [showSocket, setShowSocket] = useState(false);
  const [socketCorner, setSocketCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-right");
  const [showShelf, setShowShelf] = useState(false);
  const [shelfWidthPercent, setShelfWidthPercent] = useState(80);
  const [showHygieneMirror, setShowHygieneMirror] = useState(false);
  const [hygieneMirrorCorner, setHygieneMirrorCorner] = useState<"bottom-left" | "bottom-right">("bottom-left");

  const controlsContent = (
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
            onChange={(e) => setWidthMm(Number(e.target.value))}
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
            onChange={(e) => setHeightMm(Number(e.target.value))}
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

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showClock}
          onChange={(e) => setShowClock(e.target.checked)}
        />
        <span>Uhr anzeigen</span>
      </label>

      {showClock && (
        <div className="config-row" style={{ marginTop: 12 }}>
          <span className="config-label">Spiegelwinkel</span>
          <select
            value={clockCorner}
            onChange={(e) => setClockCorner(e.target.value as "top-left" | "top-right" | "bottom-left" | "bottom-right")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "14px"
            }}
          >
            <option value="top-left">Oben links</option>
            <option value="top-right">Oben rechts</option>
            <option value="bottom-left">Unten links</option>
            <option value="bottom-right">Unten rechts</option>
          </select>
        </div>
      )}

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showSocket}
          onChange={(e) => setShowSocket(e.target.checked)}
        />
        <span>Steckdose anzeigen</span>
      </label>

      {showSocket && (
        <div className="config-row" style={{ marginTop: 12 }}>
          <span className="config-label">Spiegelwinkel</span>
          <select
            value={socketCorner}
            onChange={(e) => setSocketCorner(e.target.value as "top-left" | "top-right" | "bottom-left" | "bottom-right")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "14px"
            }}
          >
            <option value="top-left">Oben links</option>
            <option value="top-right">Oben rechts</option>
            <option value="bottom-left">Unten links</option>
            <option value="bottom-right">Unten rechts</option>
          </select>
        </div>
      )}

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showShelf}
          onChange={(e) => setShowShelf(e.target.checked)}
        />
        <span>Glasregal anzeigen</span>
      </label>

      {showShelf && (
        <div className="config-row" style={{ marginTop: 12 }}>
          <span className="config-label">Regalbreite</span>
          <div className="slider-row">
            <span>
              10% – 100%
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={shelfWidthPercent}
              onChange={(e) => setShelfWidthPercent(Number(e.target.value))}
            />
            <span className="dimension-value">{shelfWidthPercent}%</span>
          </div>
        </div>
      )}

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showHygieneMirror}
          onChange={(e) => setShowHygieneMirror(e.target.checked)}
        />
        <span>Hygienespiegel anzeigen</span>
      </label>

      {showHygieneMirror && (
        <div className="config-row" style={{ marginTop: 12 }}>
          <span className="config-label">Spiegelwinkel</span>
          <select
            value={hygieneMirrorCorner}
            onChange={(e) => setHygieneMirrorCorner(e.target.value as "bottom-left" | "bottom-right")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "14px"
            }}
          >
            <option value="bottom-left">Unten links</option>
            <option value="bottom-right">Unten rechts</option>
          </select>
        </div>
      )}
    </div>
  );

  if (showControls) {
    return controlsContent;
  }

  return (
    <div className="canvas-wrapper" style={{ position: "relative" }}>
      <MirrorScene
        widthMm={widthMm}
        heightMm={heightMm}
        showWall={showWall}
        showroomLight={showLight}
        showClock={showClock}
        clockCorner={clockCorner}
        showSocket={showSocket}
        socketCorner={socketCorner}
        showShelf={showShelf}
        shelfWidthPercent={shelfWidthPercent}
        showHygieneMirror={showHygieneMirror}
        hygieneMirrorCorner={hygieneMirrorCorner}
      />

      <div className="dimension-badge">
        <span>Breite: {widthMm} mm</span>
        <span>Höhe: {heightMm} mm</span>
      </div>
    </div>
  );
}

