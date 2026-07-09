import React, { useState } from "react";
import { X, Copy, Mail, MessageSquare, Link2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";

export default function InviteModal({ tables = [], defaultTable, onClose }) {
  const [tableId, setTableId] = useState(defaultTable?.id || tables[0]?.id || "");
  const [maxUses, setMaxUses] = useState(50);
  const [days, setDays] = useState(30);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!tableId) return toast.error("Pick a table");
    setBusy(true);
    try {
      const { data } = await api.post("/invites", { table_id: tableId, max_uses: Number(maxUses), expires_in_days: Number(days) });
      setCode(data.code);
      toast.success("Invite code ready");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const copy = () => navigator.clipboard.writeText(code).then(() => toast.success("Copied"));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="invite-modal">
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Invite Someone</div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <label style={lbl}>Table</label>
          <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)} data-testid="invite-table" style={{ margin: "6px 0 10px" }}>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Max Uses</label>
              <input type="number" className="input" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} min={1} max={500} data-testid="invite-max-uses" style={{ marginTop: 6 }} />
            </div>
            <div>
              <label style={lbl}>Expires (days)</label>
              <input type="number" className="input" value={days} onChange={(e) => setDays(e.target.value)} min={1} max={90} data-testid="invite-days" style={{ marginTop: 6 }} />
            </div>
          </div>
          {!code ? (
            <button className="btn btn-primary" onClick={generate} disabled={busy} data-testid="invite-generate" style={{ width: "100%" }}><Link2 size={14} /> {busy ? "Generating…" : "Generate Invite Code"}</button>
          ) : (
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 12, padding: 16 }}>
              <div style={lbl}>Invite Code</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, fontFamily: "Menlo, monospace" }}>{code}</div>
                <button className="btn btn-secondary" onClick={copy} data-testid="invite-copy"><Copy size={13} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <a className="btn btn-secondary" href={`sms:?body=Join my MICRO table with code ${code}`} data-testid="invite-sms"><MessageSquare size={13} /> SMS</a>
                <a className="btn btn-secondary" href={`mailto:?subject=Come to my MICRO table&body=Join with code: ${code}`} data-testid="invite-email"><Mail size={13} /> Email</a>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
