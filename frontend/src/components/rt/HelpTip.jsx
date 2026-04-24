import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";

/**
 * Help tip — user-triggered (click ? icon to show/hide).
 * No auto-display. Users choose when to see help.
 */
export default function HelpTip({ section, text }) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setShow((v) => !v)}
        data-testid={`help-toggle-${section}`}
        style={{
          width: 24, height: 24, borderRadius: "50%", border: "none",
          background: show ? "var(--mac-blue)" : "var(--bg-tertiary)",
          color: show ? "#fff" : "var(--text-tertiary)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {show ? <X size={12} /> : <HelpCircle size={12} />}
      </button>
      {show && (
        <div className="help-tip" style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6,
          zIndex: 80, width: 260,
        }} data-testid={`help-${section}`}>
          <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>{text}</div>
          </div>
        </div>
      )}
    </div>
  );
}
