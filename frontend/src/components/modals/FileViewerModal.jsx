import React, { useEffect, useState, useRef, useCallback } from "react";
import { X, Download, Play, Pause, ChevronLeft, ChevronRight, Monitor, MonitorOff } from "lucide-react";
import { useRTEvent, sendWS } from "../../lib/realtime";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

function fileCategory(item) {
  const mime = (item.mime_type || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return "video";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "other";
}

export default function FileViewerModal({ item, tableId, onClose, isPresenting, presenterData }) {
  const category = fileCategory(item);
  const fileUrl = item.url?.startsWith("http") ? item.url : `${API}/api/files/${item.url}`;

  const [presenting, setPresenting] = useState(isPresenting || false);
  const [remoteState, setRemoteState] = useState(presenterData || null);
  const videoRef = useRef(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPages, setPdfPages] = useState(1);

  // Listen for presenter sync events
  useRTEvent((evt) => {
    if (!evt || evt.type !== "present_sync" || evt.table_id !== tableId) return;
    if (presenting) return; // presenter doesn't follow
    setRemoteState(evt.state);
    if (evt.state?.type === "video" && videoRef.current) {
      if (evt.state.paused && !videoRef.current.paused) videoRef.current.pause();
      if (!evt.state.paused && videoRef.current.paused) videoRef.current.play().catch(() => {});
      if (Math.abs(videoRef.current.currentTime - evt.state.currentTime) > 2) {
        videoRef.current.currentTime = evt.state.currentTime;
      }
    }
    if (evt.state?.type === "pdf") {
      setPdfPage(evt.state.page || 1);
    }
  }, [tableId, presenting]);

  // Broadcast sync state
  const broadcastSync = useCallback((state) => {
    if (!presenting) return;
    sendWS({ type: "present_sync", table_id: tableId, item_id: item.id, state });
  }, [presenting, tableId, item.id]);

  const startPresenting = () => {
    setPresenting(true);
    sendWS({ type: "present_start", table_id: tableId, item_id: item.id, item_name: item.name, item_url: item.url, item_mime: item.mime_type, category });
    toast.success("Presenting to table — everyone can see this");
  };

  const stopPresenting = () => {
    setPresenting(false);
    sendWS({ type: "present_stop", table_id: tableId });
    toast.success("Stopped presenting");
  };

  // Video sync on play/pause/seek
  const handleVideoEvent = (e) => {
    if (!presenting) return;
    broadcastSync({
      type: "video",
      currentTime: videoRef.current?.currentTime || 0,
      paused: videoRef.current?.paused ?? true,
    });
  };

  const handlePdfPage = (newPage) => {
    const p = Math.max(1, Math.min(pdfPages, newPage));
    setPdfPage(p);
    if (presenting) broadcastSync({ type: "pdf", page: p });
  };

  // Escape to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 140,
      background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column",
    }} data-testid="file-viewer-modal">
      {/* Header */}
      <div style={{
        padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {item.name}
          {presenting && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "var(--mac-red)", color: "#fff", fontWeight: 700 }}>PRESENTING</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tableId && (
            <button
              onClick={presenting ? stopPresenting : startPresenting}
              data-testid="file-viewer-present-toggle"
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: presenting ? "var(--mac-red)" : "var(--mac-blue)", color: "#fff",
              }}
            >
              {presenting ? <><MonitorOff size={13} /> Stop</> : <><Monitor size={13} /> Present to Table</>}
            </button>
          )}
          <a href={fileUrl} download={item.name} style={iconBtn} data-testid="file-viewer-download" title="Download">
            <Download size={16} color="#fff" />
          </a>
          <button onClick={onClose} style={iconBtn} data-testid="file-viewer-close"><X size={16} color="#fff" /></button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 16 }}>
        {category === "image" && (
          <img
            src={fileUrl}
            alt={item.name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
            data-testid="file-viewer-image"
          />
        )}

        {category === "video" && (
          <video
            ref={videoRef}
            src={fileUrl}
            controls
            autoPlay={!isPresenting}
            onPlay={handleVideoEvent}
            onPause={handleVideoEvent}
            onSeeked={handleVideoEvent}
            data-testid="file-viewer-video"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
          />
        )}

        {category === "pdf" && (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <iframe
              src={`${fileUrl}#page=${pdfPage}`}
              title={item.name}
              style={{ flex: 1, width: "100%", maxWidth: 900, border: "none", borderRadius: 8, background: "#fff" }}
              data-testid="file-viewer-pdf"
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, color: "#fff" }}>
              <button onClick={() => handlePdfPage(pdfPage - 1)} disabled={pdfPage <= 1} style={navBtn} data-testid="pdf-prev">
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13 }}>Page {pdfPage}</span>
              <button onClick={() => handlePdfPage(pdfPage + 1)} style={navBtn} data-testid="pdf-next">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {category === "other" && (
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
              <Download size={48} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{item.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
              {item.mime_type || "Unknown type"} {item.file_size ? `· ${(item.file_size / 1024).toFixed(1)} KB` : ""}
            </div>
            <a href={fileUrl} download={item.name} className="btn btn-primary" data-testid="file-viewer-download-btn">
              <Download size={14} /> Download File
            </a>
          </div>
        )}
      </div>

      {/* Shared by info */}
      <div style={{ padding: "8px 16px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
        Shared by {item.shared_by_name} · Press Escape to close
      </div>
    </div>
  );
}

const iconBtn = {
  width: 36, height: 36, borderRadius: 8, border: "none",
  background: "rgba(255,255,255,0.1)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  textDecoration: "none",
};

const navBtn = {
  width: 36, height: 36, borderRadius: "50%", border: "none",
  background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
