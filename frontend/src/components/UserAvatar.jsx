import React from "react";

/**
 * Renders user avatar — DiceBear image if avatar_url exists, initials fallback.
 * Drop-in replacement for the inline .avatar divs used throughout the app.
 */
export default function UserAvatar({ user, size = 32, fontSize, style = {}, className = "" }) {
  const s = size;
  const fs = fontSize || Math.round(s * 0.38);
  const initials = user?.initials || (user?.name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const color = user?.color || "#007AFF";
  const avatarUrl = user?.avatar_url;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user?.name || "Avatar"}
        className={className}
        style={{
          width: s, height: s, borderRadius: s > 48 ? 16 : s > 32 ? 12 : 8,
          objectFit: "cover", flexShrink: 0,
          ...style,
        }}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: s, height: s, background: color,
        fontSize: fs, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
