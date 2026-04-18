import React, { useState } from "react";
import { Check } from "lucide-react";

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

const SEEDS = ["Luna", "Felix", "Sage", "River", "Sky", "Ember", "Storm", "Dawn", "Kai", "Nova", "Zion", "Eden", "Wren", "Atlas", "Cruz", "Indie", "Lark", "Onyx", "Rune", "Vale", "Blaze", "Cove", "Frost", "Jade"];

function avatarUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

export default function AvatarPicker({ currentUrl, onSelect, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selected, setSelected] = useState(currentUrl || null);

  const handlePick = (url) => {
    setSelected(url);
  };

  const confirm = () => {
    onSelect?.(selected);
    onClose?.();
  };

  const clearAvatar = () => {
    onSelect?.(null);
    onClose?.();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()} data-testid="avatar-picker-modal">
      <div className="modal-box" style={{ maxWidth: 580, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Choose Your Avatar</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Pick a style, then choose your look</div>
        </div>

        {/* Style tabs */}
        <div style={{ display: "flex", gap: 4, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
          {STYLES.map((s) => (
            <button
              key={s.id}
              className={`btn ${selectedStyle === s.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSelectedStyle(s.id)}
              style={{ fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0 }}
              data-testid={`avatar-style-${s.id}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Avatar grid */}
        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {SEEDS.map((seed) => {
              const url = avatarUrl(selectedStyle, seed);
              const isSelected = selected === url;
              return (
                <button
                  key={seed}
                  onClick={() => handlePick(url)}
                  data-testid={`avatar-option-${seed}`}
                  style={{
                    width: "100%", aspectRatio: "1", borderRadius: 16,
                    border: isSelected ? "3px solid var(--mac-blue)" : "2px solid var(--border-light)",
                    background: "var(--bg-tertiary)", cursor: "pointer",
                    padding: 4, position: "relative", overflow: "hidden",
                    transition: "border-color 0.15s, transform 0.15s",
                    transform: isSelected ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  <img src={url} alt={seed} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} loading="lazy" />
                  {isSelected && (
                    <div style={{
                      position: "absolute", top: 2, right: 2, width: 18, height: 18,
                      borderRadius: "50%", background: "var(--mac-blue)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={10} color="#fff" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-light)", display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button className="btn btn-secondary" onClick={clearAvatar} data-testid="avatar-clear">Use Initials</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} data-testid="avatar-cancel">Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={!selected} data-testid="avatar-confirm">
              Save Avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
