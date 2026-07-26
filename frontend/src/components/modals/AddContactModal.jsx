import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";

export default function AddContactModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      await api.post("/contacts", form);
      toast.success("Contact added");
      onCreated?.();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal" role="dialog" aria-modal="true" data-testid="add-contact-modal">
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Add Contact</div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <label style={lbl} htmlFor="add-contact-name">Name</label>
          <input id="add-contact-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="contact-name" style={{ margin: "6px 0 10px" }} />
          <label style={lbl} htmlFor="add-contact-phone">Phone (optional)</label>
          <input id="add-contact-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="contact-phone" style={{ margin: "6px 0 10px" }} />
          <label style={lbl} htmlFor="add-contact-email">Email (optional)</label>
          <input id="add-contact-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="contact-email" style={{ margin: "6px 0 0" }} />
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} data-testid="contact-submit">{busy ? "Adding…" : "Add Contact"}</button>
        </div>
      </div>
    </div>
  );
}
const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
