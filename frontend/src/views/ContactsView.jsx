import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Search, Check, UserPlus, Plus, MessageSquare, Phone, Mail, Trash2 } from "lucide-react";
import EmptyState from "../components/rt/EmptyState";
import HelpTip from "../components/rt/HelpTip";
import { toast } from "sonner";

export default function ContactsView({ onAdd, onInvite }) {
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState({ sms_configured: false, email_configured: false });
  const [smsTarget, setSmsTarget] = useState(null);
  const [smsText, setSmsText] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);

  const load = () => api.get("/contacts").then((r) => setContacts(r.data || []));
  useEffect(() => {
    load();
    api.get("/bridges/status").then((r) => setBridgeStatus(r.data)).catch(() => {});
  }, []);

  const sendSms = async () => {
    if (!smsTarget || !smsText.trim()) return;
    setSmsBusy(true);
    try {
      await api.post("/bridges/sms", { phone: smsTarget.phone, message: smsText.trim() });
      toast.success(`SMS sent to ${smsTarget.name}`);
      setSmsText("");
      setSmsTarget(null);
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed to send SMS";
      toast.error(detail);
    } finally {
      setSmsBusy(false);
    }
  };

  const deleteContact = async (c) => {
    await api.delete(`/contacts/${c.id}`);
    toast.success(`${c.name} removed`);
    load();
  };

  const matched = contacts.filter((c) => (c.name || "").toLowerCase().includes(query.toLowerCase()));
  const onApp = matched.filter((c) => c.is_member);
  const offApp = matched.filter((c) => !c.is_member);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <HelpTip section="contacts" text="Everyone you know. Green check = already on Roundtable_VO. Blue button = invite them." />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Contacts</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onInvite} data-testid="contacts-invite-btn"><UserPlus size={14} /> Invite</button>
          <button className="btn btn-primary" onClick={onAdd} data-testid="contacts-add-btn"><Plus size={14} /> Add Contact</button>
        </div>
      </div>

      <div className="card" style={{ padding: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
          <Search size={14} color="var(--text-tertiary)" />
          <input className="input" style={{ border: "none", background: "transparent", padding: 4 }} placeholder="Search contacts..." value={query} onChange={(e) => setQuery(e.target.value)} data-testid="contacts-search" />
        </div>
      </div>

      {/* SMS compose overlay */}
      {smsTarget && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: "4px solid var(--mac-green)" }} data-testid="sms-compose">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              <Phone size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              SMS to {smsTarget.name} ({smsTarget.phone})
            </div>
            <button className="btn btn-ghost" onClick={() => setSmsTarget(null)} style={{ fontSize: 11 }}>Cancel</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendSms()}
              placeholder="Type your message..."
              maxLength={1600}
              data-testid="sms-compose-input"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={sendSms} disabled={smsBusy || !smsText.trim()} data-testid="sms-compose-send">
              {smsBusy ? "Sending..." : "Send SMS"}
            </button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState icon={<UserPlus size={28} />} title="No contacts yet" subtitle="Add people to grow your network." action={<button className="btn btn-primary" onClick={onAdd} data-testid="contacts-empty-add">Add Contact</button>} testId="contacts-empty" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Section title={`On Roundtable_VO (${onApp.length})`} emptyMsg="Nobody from your contacts is on yet." color="var(--mac-green)">
            {onApp.map((c) => (
              <Row key={c.id} contact={c} isMember onDelete={() => deleteContact(c)} />
            ))}
          </Section>
          <Section title={`Not on Roundtable_VO (${offApp.length})`} emptyMsg="Everyone's already in." color="var(--mac-blue)">
            {offApp.map((c) => (
              <Row key={c.id} contact={c} onInvite={onInvite} smsEnabled={bridgeStatus.sms_configured} emailEnabled={bridgeStatus.email_configured} onSms={(contact) => setSmsTarget(contact)} onDelete={() => deleteContact(c)} />
            ))}
          </Section>
        </div>
      )}

      {/* Bridge status indicators */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <div className="card" style={{ padding: 12, flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <Phone size={16} color={bridgeStatus.sms_configured ? "var(--mac-green)" : "var(--text-tertiary)"} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>SMS Bridge</div>
            <div style={{ fontSize: 10, color: bridgeStatus.sms_configured ? "var(--mac-green)" : "var(--text-secondary)" }}>
              {bridgeStatus.sms_configured ? "Active — Twilio connected" : "Not configured"}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 12, flex: 1, display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
          <Mail size={16} color="var(--text-tertiary)" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              Email Bridge
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "var(--mac-orange)", color: "#fff", fontWeight: 700, letterSpacing: 0.5 }} data-testid="email-coming-soon">
                COMING SOON
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Reach people via email — launching soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, emptyMsg, color, children }) {
  const arr = React.Children.toArray(children);
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
      {arr.length === 0 ? <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{emptyMsg}</div> : children}
    </div>
  );
}

function Row({ contact, isMember, onInvite, smsEnabled, emailEnabled, onSms, onDelete }) {
  const init = (contact.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-light)" }} data-testid={`contact-${contact.id}`}>
      <div className="avatar" style={{ width: 32, height: 32, background: contact.member_color || "#8E8E93", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{contact.member_initials || init}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {contact.name}
          {isMember && <Check size={12} color="var(--mac-green)" />}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.email || contact.phone || "No contact info"}</div>
      </div>
      {isMember ? (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-secondary" data-testid={`contact-chat-${contact.id}`}><MessageSquare size={12} /></button>
          <button className="btn btn-ghost" onClick={onDelete} data-testid={`contact-delete-${contact.id}`} style={{ color: "var(--mac-red)", padding: 4 }}><Trash2 size={12} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4 }}>
          {smsEnabled && contact.phone && (
            <button className="btn btn-secondary" onClick={() => onSms?.(contact)} data-testid={`contact-sms-${contact.id}`} title="Send SMS">
              <Phone size={12} />
            </button>
          )}
          <button className="btn btn-primary" onClick={onInvite} data-testid={`contact-invite-${contact.id}`}>Invite</button>
          <button className="btn btn-ghost" onClick={onDelete} data-testid={`contact-del-${contact.id}`} style={{ color: "var(--mac-red)", padding: 4 }}><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );
}
