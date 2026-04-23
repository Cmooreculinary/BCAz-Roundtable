import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Contextual help tooltip — shows once per section, auto-dismisses after 8s.
 * Uses sessionStorage for non-sensitive UI dismiss state only.
 * No PII or auth data is stored. Keys: "rt-help-{section}" = "1" when dismissed.
 */
export default function HelpTip({ section, text, position = "top-right" }) {
  const key = `rt-help-${section}`;
  const [show, setShow] = useState(() => !sessionStorage.getItem(key));

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      sessionStorage.setItem(key, "1");
      setShow(false);
    }, 8000);
    return () => clearTimeout(t);
  }, [show, key]);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem(key, "1");
    setShow(false);
  };

  const posStyle =
    position === "top-right" ? { top: 68, right: 16 }
    : position === "bottom-right" ? { bottom: 120, right: 16 }
    : { top: 68, left: 260 };

  return (
    <div className="help-tip" style={posStyle} data-testid={`help-${section}`}>
      <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>{text}</div>
        <button onClick={dismiss} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 2 }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
