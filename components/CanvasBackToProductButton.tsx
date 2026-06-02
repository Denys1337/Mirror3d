"use client";

import { useEffect, useRef, useState } from "react";

type CanvasBackToProductButtonProps = {
  href: string;
};

function navigateToProductPage(href: string) {
  const target = window.top ?? window;
  target.location.href = href;
}

export default function CanvasBackToProductButton({
  href,
}: CanvasBackToProductButtonProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popupOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const root = wrapRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setPopupOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopupOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [popupOpen]);

  return (
    <div ref={wrapRef} className="canvas-back-to-product-wrap">
      <button
        type="button"
        className="canvas-back-to-product"
        aria-expanded={popupOpen}
        aria-haspopup="dialog"
        onClick={() => setPopupOpen((open) => !open)}
      >
        <span className="canvas-back-to-product__icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 8H3M3 8L7.5 11.5M3 8L7.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
          </svg>
        </span>
        <span className="canvas-back-to-product__label">
          Zurück zur Produktseite
        </span>
      </button>

      {popupOpen ? (
        <div
          className="canvas-back-confirm-popup"
          role="dialog"
          aria-labelledby="canvas-back-confirm-title"
        >
          <p id="canvas-back-confirm-title" className="canvas-back-confirm-popup__text">
            Sie haben die Konfiguration des Spiegels nicht abgeschlossen, daher
            werden die ausgewählten Optionen nicht gespeichert. Sie können den
            Artikel im Schritt{" "}
            <strong className="canvas-back-confirm-popup__highlight">
              „Zusammenfassung“
            </strong>{" "}
            in den Warenkorb legen, um die ausgewählten Parameter zu speichern
          </p>
          <div className="canvas-back-confirm-popup__actions">
            <button
              type="button"
              className="canvas-back-confirm-popup__btn canvas-back-confirm-popup__btn--leave"
              onClick={() => navigateToProductPage(href)}
            >
              Zurück zur Produktseite
            </button>
            <button
              type="button"
              className="canvas-back-confirm-popup__btn canvas-back-confirm-popup__btn--stay"
              onClick={() => setPopupOpen(false)}
            >
              Weiter konfigurieren
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
