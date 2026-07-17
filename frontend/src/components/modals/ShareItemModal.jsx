import React, { useState, useRef } from "react";
import { X, UploadCloud, Image, FileText, Video, Music, Link2, StickyNote, Sheet, Presentation, HeartHandshake, Sparkles, CheckCircle } from "lucide-react";
import { api, API, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const TYPES = [
  { key: "photo", label: "Photo", icon: <Image size={18} />, color: "#34C759" },
  { key: "document", label: "Document", icon: <FileText size={18} />, color: "#007AFF" },
  { key: "video", label: "Video", icon: <Video size={18} />, color: "#FF3B30" },
  { key: "audio", label: "Audio", icon: <Music size={18} />, color: "#AF52DE" },
  { key: "link", label: "Link", icon: <Link2 size={18} />, color: "#5AC8FA" },
  { key: "note", label: "Note", icon: <StickyNote size={18} />, color: "#FFCC00" },
  { key: "spreadsheet", label: "Sheet", icon: <Sheet size={18} />, color: "#FF9500" },
  { key: "presentation", label: "Slides", icon: <Presentation size={18} />, color: "#FF2D55" },
  { key: "prayer", label: "Prayer", icon: <HeartHandshake size={18} />, color: "#AF52DE" },
  { key: "intention", label: "Intention", icon: <Sparkles size={18} />, color: "#FFCC00" },
];

export default function ShareItemModal({ tables = [], defaultTable, onClose, onShared }) {
  const [tableId, setTableId] = useState(defaultTable?.id || tables[0]?.id || "");
  const [type, setType] = useState("document");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const fileRef = useRef();

  const submit = async () => {
    if (!tableId) return toast.error("Pick a table");
    if (type === "note" || type === "prayer" || type === "intention") {
      if (!name.trim()) return toast.error("Give this a name");
      await api.post(`/tables/${tableId}/items`, { type, name: name.trim(), url: note || undefined });
      toast.success("Shared");
      onShared?.();
      return;
    }
    if (type === "link") {
      if (!url.trim()) return toast.error("Paste a link");
      await api.post(`/tables/${tableId}/items`, { type: "link", name: name.trim() || url, url });
      toast.success("Shared");
      onShared?.();
      return;
    }
    // file upload
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Pick a file to upload");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/upload`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const error = new Error(`Upload failed: ${res.status}`);
        error.response = { data: body };
        throw error;
      }
      const up = await res.json();
      await api.post(`/tables/${tableId}/items`, {
        type,
        name: name.trim() || file.name,
        url: up.storage_path,
        file_size: up.size,
        mime_type: file.type,
      });
      toast.success("Shared");
      onShared?.();
    } catch (e) {
      toast.error(formatApiError(e, "Upload failed"));
    } finally { setUploading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="share-item-modal">
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Share to the table</div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <label style={lbl}>Table</label>
          <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)} data-testid="share-table" style={{ margin: "6px 0 14px" }}>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <label style={lbl}>Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "8px 0 14px" }}>
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                data-testid={`share-type-${t.key}`}
                style={{
                  padding: 10, borderRadius: 10, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  border: type === t.key ? `2px solid ${t.color}` : "1px solid var(--border-color)",
                  background: type === t.key ? `${t.color}1a` : "var(--bg-secondary)",
                  color: t.color, fontSize: 10, fontWeight: 600,
                }}>
                {t.icon}
                <span style={{ color: "var(--text-primary)" }}>{t.label}</span>
              </button>
            ))}
          </div>

          <label style={lbl}>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What do you want to call this?" data-testid="share-name" style={{ margin: "6px 0 10px" }} />

          {type === "link" && (
            <>
              <label style={lbl}>URL</label>
              <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-testid="share-url" style={{ margin: "6px 0 10px" }} />
            </>
          )}

          {type === "note" && (
            <>
              <label style={lbl}>Note</label>
              <textarea className="input" rows={5} value={note} onChange={(e) => setNote(e.target.value)} data-testid="share-note" style={{ margin: "6px 0 10px", fontFamily: "inherit", resize: "vertical" }} />
            </>
          )}

          {(type === "prayer" || type === "intention") && (
            <>
              <label style={lbl}>{type === "prayer" ? "Prayer Request" : "Intention"}</label>
              <textarea className="input" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "prayer" ? "What would you like the group to pray for?" : "What is your intention?"} data-testid="share-prayer" style={{ margin: "6px 0 10px", fontFamily: "inherit", resize: "vertical" }} />
            </>
          )}

          {type !== "link" && type !== "note" && type !== "prayer" && type !== "intention" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0] && fileRef.current) { fileRef.current.files = e.dataTransfer.files; setFileSelected(true); } }}
              style={{
                border: `2px dashed ${dragOver ? "var(--mac-blue)" : fileSelected ? "var(--mac-green)" : "var(--border-color)"}`,
                borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer",
                background: dragOver ? "rgba(0,122,255,0.06)" : fileSelected ? "rgba(52,199,89,0.06)" : "transparent",
                transition: "all 0.2s",
              }}
              onClick={() => fileRef.current?.click()}
              data-testid="share-drop"
            >
              {fileSelected ? <CheckCircle size={28} color="var(--mac-green)" style={{ marginBottom: 8 }} /> : <UploadCloud size={28} color={dragOver ? "var(--mac-blue)" : "var(--text-tertiary)"} style={{ marginBottom: 8 }} />}
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fileSelected ? (fileRef.current?.files?.[0]?.name || "File selected") : dragOver ? "Drop it here!" : "Drop a file or click to browse"}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Max 50MB</div>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={() => setFileSelected(!!fileRef.current?.files?.length)} data-testid="share-file-input" />
            </div>
          )}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={uploading} data-testid="share-submit">{uploading ? "Uploading…" : "Share"}</button>
        </div>
      </div>
    </div>
  );
}
const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
