import React, { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

const STYLES = [
  { id: "adventurer", label: "Adventurer" },
  { id: "avataaars", label: "Classic" },
  { id: "big-ears", label: "Big Ears" },
  { id: "bottts", label: "Robots" },
  { id: "fun-emoji", label: "Emoji" },
  { id: "lorelei", label: "Lorelei" },
  { id: "micah", label: "Micah" },
  { id: "notionists", label: "Notion" },
  { id: "open-peeps", label: "Peeps" },
  { id: "pixel-art", label: "Pixel" },
  { id: "thumbs", label: "Thumbs" },
  { id: "personas", label: "Personas" },
];

const SEEDS = [
  "Luna", "Felix", "Sage", "River", "Sky", "Ember", "Storm", "Dawn",
  "Kai", "Nova", "Zion", "Eden", "Wren", "Atlas", "Cruz", "Indie",
  "Lark", "Onyx", "Rune", "Vale", "Blaze", "Cove", "Frost", "Jade",
];

function avatarUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&size=120`;
}

export default function AvatarPicker({ currentUrl, onSelect, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selected, setSelected] = useState(currentUrl || null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const confirm = () => {
    onSelect?.(selected);
    onClose?.();
  };

  const clearAvatar = () => {
    onSelect?.(null);
    onClose?.();
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
      data-testid="avatar-picker-modal"
      role="presentation"
    >
      <div
        className="modal-box avatar-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        aria-describedby="avatar-picker-description"
      >
        <header className="avatar-picker-header">
          <div>
            <div id="avatar-picker-title" className="avatar-picker-title">Choose Your Avatar</div>
            <div id="avatar-picker-description" className="avatar-picker-description">Pick a style, then choose your look.</div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn btn-ghost avatar-picker-close"
            onClick={onClose}
            aria-label="Close avatar picker"
            data-testid="avatar-close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="avatar-picker-styles" role="tablist" aria-label="Avatar styles">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`btn ${selectedStyle === style.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSelectedStyle(style.id)}
              role="tab"
              aria-selected={selectedStyle === style.id}
              data-testid={`avatar-style-${style.id}`}
            >
              {style.label}
            </button>
          ))}
        </div>

        <div className="avatar-picker-scroll">
          <div className="avatar-picker-grid" role="radiogroup" aria-label="Avatar options">
            {SEEDS.map((seed) => {
              const url = avatarUrl(selectedStyle, seed);
              const isSelected = selected === url;
              return (
                <button
                  key={`${selectedStyle}-${seed}`}
                  type="button"
                  className={`avatar-picker-option${isSelected ? " selected" : ""}`}
                  onClick={() => setSelected(url)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${seed}${isSelected ? ", selected" : ""}`}
                  data-testid={`avatar-option-${seed}`}
                >
                  <img src={url} alt="" loading="lazy" />
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

        <footer className="avatar-picker-actions">
          <button type="button" className="btn btn-secondary" onClick={clearAvatar} data-testid="avatar-clear">
            Use Initials
          </button>
          <div>
            <button type="button" className="btn btn-secondary" onClick={onClose} data-testid="avatar-cancel">
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={!selected} data-testid="avatar-confirm">
              Save Avatar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
