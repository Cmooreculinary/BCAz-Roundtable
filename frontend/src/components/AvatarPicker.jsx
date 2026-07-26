import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { PORTRAIT_SEEDS, avatarSrc, isPortraitRef, portraitDataUri, portraitRef, seedFromRef } from "../lib/avatars";
import { AudienceFigure, SeatedFigure } from "./rt/Figure";
import "../styles/avatar-picker.css";

/**
 * How the same portrait reads in each place it appears. Picking a face is
 * really picking the person who will be sitting in a chair, so the preview
 * shows the chair — not just a headshot.
 */
const PREVIEWS = [
  { id: "portrait", label: "Portrait" },
  { id: "seated", label: "At the table" },
  { id: "audience", label: "In the house" },
];

/** Extra seeds, so the gallery is deeper than the cast used in the studio. */
const EXTRA_SEEDS = [
  "Aurelio", "Nadia", "Bram", "Chidi", "Ingrid", "Malik",
  "Rosa", "Tobias", "Zainab", "Cedric", "Mei", "Anton",
];

const GALLERY = [...PORTRAIT_SEEDS, ...EXTRA_SEEDS];

export default function AvatarPicker({ currentUrl, onSelect, onClose }) {
  const [preview, setPreview] = useState(PREVIEWS[0].id);
  const [selectedSeed, setSelectedSeed] = useState(() => seedFromRef(currentUrl));
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const heroSeed = selectedSeed || GALLERY[0];
  const heroSrc = useMemo(() => portraitDataUri(heroSeed), [heroSeed]);

  // A face already stored as an image URL (an older avatar) is kept visible so
  // switching to the portrait set is a choice, not a silent overwrite.
  const legacyUrl = !isPortraitRef(currentUrl) ? avatarSrc(currentUrl) : null;

  const confirm = () => {
    if (!selectedSeed) return;
    onSelect?.(portraitRef(selectedSeed));
    onClose?.();
  };

  const clearAvatar = () => {
    onSelect?.(null);
    onClose?.();
  };

  return (
    <div
      className="modal-overlay avatar-picker-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
      data-testid="avatar-picker-modal"
      role="presentation"
    >
      <div
        className="avatar-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        aria-describedby="avatar-picker-description"
      >
        <header className="avatar-picker-header">
          <div>
            <span className="avatar-picker-eyebrow">Roundtable portraits</span>
            <div id="avatar-picker-title" className="avatar-picker-title">Choose your face</div>
            <div id="avatar-picker-description" className="avatar-picker-description">
              Tailored, warm-lit, and readable from any seat in the room — at the table and in the house.
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="avatar-picker-close"
            onClick={onClose}
            aria-label="Close avatar picker"
            data-testid="avatar-close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="avatar-picker-body">
          <div className="avatar-picker-hero">
            <div className="avatar-picker-hero__stage" data-testid="avatar-preview">
              {preview === "portrait" && <img src={heroSrc} alt="" className="avatar-picker-hero__bust" />}
              {preview === "seated" && <SeatedFigure seed={heroSeed} view="front" pose="idle" size={150} highlight />}
              {preview === "audience" && <AudienceFigure seed={heroSeed} pose="clap" size={96} highlight />}
            </div>
            <div className="avatar-picker-styles" role="tablist" aria-label="Preview context">
              {PREVIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`avatar-picker-style${preview === item.id ? " is-active" : ""}`}
                  onClick={() => setPreview(item.id)}
                  role="tab"
                  aria-selected={preview === item.id}
                  data-testid={`avatar-style-${item.id}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {legacyUrl && (
              <div className="avatar-picker-legacy">
                <img src={legacyUrl} alt="" />
                <span>Your current avatar. Choosing below replaces it.</span>
              </div>
            )}
          </div>

          <div className="avatar-picker-scroll">
            <div className="avatar-picker-grid" role="radiogroup" aria-label="Avatar options">
              {GALLERY.map((seed) => {
                const isSelected = selectedSeed === seed;
                return (
                  <button
                    key={seed}
                    type="button"
                    className={`avatar-picker-option${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedSeed(seed)}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${seed}${isSelected ? ", selected" : ""}`}
                    data-testid={`avatar-option-${seed}`}
                  >
                    <img src={portraitDataUri(seed)} alt="" loading="lazy" />
                    {isSelected && (
                      <span className="avatar-picker-check" aria-hidden="true">
                        <Check size={11} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="avatar-picker-actions">
          <button type="button" className="btn btn-ghost" onClick={clearAvatar} data-testid="avatar-clear">
            Use Initials
          </button>
          <div>
            <button type="button" className="btn btn-secondary" onClick={onClose} data-testid="avatar-cancel">
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={!selectedSeed} data-testid="avatar-confirm">
              Save Avatar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
