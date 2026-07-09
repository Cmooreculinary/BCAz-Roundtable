import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Settings2, Users, Play, Layers, CreditCard, FileText, ChevronRight, RotateCcw, UserPlus, Save, X, MessageSquare, Mic, File, Calendar, UtensilsCrossed, StickyNote, Sparkles, Link2, ArrowLeft, Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { ROOMS, TABLES, TABLETOPS, FOODS, AMBIANCES, MUSICS } from "../lib/scenes";

/* ═══════════════════════════════════════════
   GATHER EXPERIENCE — Room Builder + Demo
   Iteration 18 — scene catalog now imported from /app/frontend/src/lib/scenes.js
   so the standalone /gather demo and the real /table/:id pages stay in lockstep.
   ═══════════════════════════════════════════ */

// Demo-only avatars (kept inline — these are pitch personas, not real users)
const DEMO_AVATARS = [
  { id: "chris", name: "Chris", role: "Host", color: "#007AFF", initials: "CH" },
  { id: "roy", name: "Roy", role: "Partner", color: "#FF9500", initials: "RO" },
  { id: "dana", name: "Pastor Dana", role: "Faith Leader", color: "#AF52DE", initials: "PD" },
  { id: "ellis", name: "Coach Ellis", role: "Mentor", color: "#34C759", initials: "CE" },
  { id: "maria", name: "Aunt Maria", role: "Family", color: "#FF2D55", initials: "AM" },
  { id: "simone", name: "Chef Simone", role: "Chef", color: "#FFCC00", initials: "CS" },
  { id: "lee", name: "PM Lee", role: "Project Manager", color: "#5AC8FA", initials: "PL" },
  { id: "ava", name: "Ava", role: "Community Lead", color: "#FF3B30", initials: "CA" },
];

const EXPLORE_CARDS = [
  { name: "Family Dinner", room: "Warm Private Dining", table: "Family Dinner Table", tabletop: "Formal Dinner", ambiance: "Warm Dinner", gradient: "linear-gradient(135deg, #6b3a1f, #a47a4c)" },
  { name: "Church Leadership", room: "Church / Community", table: "Mahogany Round", tabletop: "Meeting Set", ambiance: "Focus Mode", gradient: "linear-gradient(135deg, #2d1a4a, #4a2d6b)" },
  { name: "Youth Sports Planning", room: "Creative Studio", table: "Drafting / Planning", tabletop: "Planning Set", ambiance: "Business Bright", gradient: "linear-gradient(135deg, #1a4a2d, #34C759)" },
  { name: "Executive Partner Dinner", room: "Skyline Executive", table: "Mahogany Round", tabletop: "Premium Chef Table", ambiance: "Evening Jazz", gradient: "linear-gradient(135deg, #0a1628, #2d5a7b)" },
  { name: "Bible Study", room: "Fireside Library", table: "Family Dinner Table", tabletop: "Coffee & Snacks", ambiance: "Fireside Calm", gradient: "linear-gradient(135deg, #4a2c1a, #6b4226)" },
  { name: "Board Meeting", room: "Skyline Executive", table: "Executive Board", tabletop: "Meeting Set", ambiance: "Business Bright", gradient: "linear-gradient(135deg, #1c1c1e, #3a3a3c)" },
  { name: "Birthday Gathering", room: "Outdoor Terrace", table: "Luncheon Table", tabletop: "Coffee & Snacks", ambiance: "Celebration", gradient: "linear-gradient(135deg, #ff2d55, #ff9500)" },
  { name: "HOA Meeting", room: "Church / Community", table: "Executive Board", tabletop: "Meeting Set", ambiance: "Focus Mode", gradient: "linear-gradient(135deg, #2c2c2e, #5a5a5e)" },
  { name: "Project War Room", room: "Creative Studio", table: "Strategy War Table", tabletop: "Planning Set", ambiance: "Focus Mode", gradient: "linear-gradient(135deg, #1c3a5c, #2d5a7b)" },
  { name: "Premium Chef Event", room: "Warm Private Dining", table: "Mahogany Round", tabletop: "Premium Chef Table", ambiance: "Evening Jazz", gradient: "linear-gradient(135deg, #FFCC00, #FF9500)" },
];

// ── Main Component ──────────────────────────
export default function GatherExperience() {
  // Parse URL params: ?for=PartnerName&autoplay=1
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const partnerName = urlParams.get("for") || "";

  const [tab, setTab] = useState("live");
  const [config, setConfig] = useState({
    room: ROOMS[0], table: TABLES[0], tabletop: TABLETOPS[3],
    food: FOODS[6], ambiance: AMBIANCES[1], music: MUSICS[1],
  });
  const [seated, setSeated] = useState([]);
  const [simRunning, setSimRunning] = useState(true);
  const [simStep, setSimStep] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const set = (key, val) => setConfig((p) => ({ ...p, [key]: val }));
  const seatAvatar = useCallback((av) => { setSeated((p) => p.find((s) => s.id === av.id) ? p : [...p, av]); }, []);
  const clearSeats = useCallback(() => setSeated([]), []);
  const autoSeat = useCallback(() => setSeated([DEMO_AVATARS[0], DEMO_AVATARS[1], DEMO_AVATARS[5], DEMO_AVATARS[6], DEMO_AVATARS[7]]), []);

  const TABS = [
    { id: "builder", label: "Room Builder", icon: <Settings2 size={15} /> },
    { id: "seats", label: "Avatar Seating", icon: <Users size={15} /> },
    { id: "live", label: "Live Table", icon: <Layers size={15} /> },
    { id: "explore", label: "Explore", icon: <ChevronRight size={15} /> },
    { id: "pricing", label: "Plans", icon: <CreditCard size={15} /> },
    { id: "notes", label: "Demo Notes", icon: <FileText size={15} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", fontFamily: "var(--font-sans)" }}>
      {/* Top nav */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
        background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
      }}>
        <a href="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Back to MICRO
        </a>
        {partnerName && (
          <div data-testid="gather-partner-badge" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
            borderRadius: 20, background: "rgba(255,204,0,0.12)",
            border: "1px solid rgba(255,204,0,0.3)", marginLeft: 12,
          }}>
            <Sparkles size={12} color="#FFCC00" />
            <span style={{ fontSize: 11, color: "#FFCC00", fontWeight: 600 }}>Built for {partnerName}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: tab === t.id ? "rgba(255,255,255,0.12)" : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.2s",
            }} data-testid={`gather-tab-${t.id}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShareOpen(true)} style={{
          padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)",
          fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, marginRight: 8,
          transition: "all 0.2s",
        }} data-testid="gather-share-btn">
          <Share2 size={14} /> Share Demo
        </button>
        <button onClick={() => { setSimRunning(true); setSimStep(0); setTab("live"); autoSeat(); set("room", ROOMS[0]); set("table", TABLES[0]); set("tabletop", TABLETOPS[3]); set("food", FOODS[6]); set("ambiance", AMBIANCES[1]); set("music", MUSICS[1]); }} style={{
          padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #007AFF, #5AC8FA)", color: "#fff",
          fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }} data-testid="gather-start-demo">
          <Play size={14} /> Guided Demo
        </button>
      </div>

      {/* Share modal */}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} initialName={partnerName} />}

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "builder" && <RoomBuilder config={config} set={set} />}
        {tab === "seats" && <AvatarSeating seated={seated} seatAvatar={seatAvatar} clearSeats={clearSeats} autoSeat={autoSeat} />}
        {tab === "live" && <LiveTableView config={config} seated={seated} simRunning={simRunning} simStep={simStep} setSimStep={setSimStep} setSimRunning={setSimRunning} setTab={setTab} autoSeat={autoSeat} />}
        {tab === "explore" && <ExploreGrid />}
        {tab === "pricing" && <PricingPreview />}
        {tab === "notes" && <DemoNotes />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  1. ROOM BUILDER
// ══════════════════════════════════════════════
function RoomBuilder({ config, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
      <div>
        <SectionTitle>Choose Your Room</SectionTitle>
        <CardGrid items={ROOMS} selected={config.room} onSelect={(r) => set("room", r)} renderCard={(r, sel) => (
          <div style={{ height: 100, background: r.gradient, borderRadius: 12, display: "flex", alignItems: "flex-end", padding: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{r.name}</span>
          </div>
        )} />

        <SectionTitle>Table Type</SectionTitle>
        <CardGrid items={TABLES} selected={config.table} onSelect={(t) => set("table", t)} renderCard={(t, sel) => (
          <div style={{ height: 80, background: t.wood, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.id === "luncheon" ? "#333" : "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>{t.name}</span>
          </div>
        )} />

        <SectionTitle>Tabletop Set</SectionTitle>
        <CardGrid items={TABLETOPS} selected={config.tabletop} onSelect={(t) => set("tabletop", t)} renderCard={(t) => (
          <div style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{t.desc}</div>
          </div>
        )} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 20 }}>
          <div>
            <SectionTitle>Food & Beverage</SectionTitle>
            {FOODS.map((f) => <RadioPill key={f.id} label={f.name} selected={config.food.id === f.id} onClick={() => set("food", f)} />)}
          </div>
          <div>
            <SectionTitle>Ambiance</SectionTitle>
            {AMBIANCES.map((a) => <RadioPill key={a.id} label={a.name} selected={config.ambiance.id === a.id} onClick={() => set("ambiance", a)} dot={a.color} />)}
          </div>
          <div>
            <SectionTitle>Music</SectionTitle>
            {MUSICS.map((m) => <RadioPill key={m.id} label={m.name} selected={config.music.id === m.id} onClick={() => set("music", m)} />)}
          </div>
        </div>
      </div>

      {/* Live preview panel */}
      <div style={{
        position: "sticky", top: 80,
        background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Live Preview</div>
        <div style={{
          height: 200, borderRadius: 12, overflow: "hidden", position: "relative",
          background: config.room.gradient, marginBottom: 14,
        }}>
          <div style={{ position: "absolute", inset: 0, background: config.ambiance.overlay }} />
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            width: 120, height: 60, borderRadius: "50%",
            background: config.table.wood, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 16 }}>{config.tabletop.icon}</span>
          </div>
        </div>
        <PreviewRow label="Room" value={config.room.name} />
        <PreviewRow label="Table" value={config.table.name} />
        <PreviewRow label="Tabletop" value={config.tabletop.name} />
        <PreviewRow label="Service" value={config.food.name} />
        <PreviewRow label="Ambiance" value={config.ambiance.name} />
        <PreviewRow label="Music" value={config.music.name} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  2. AVATAR SEATING
// ══════════════════════════════════════════════
function AvatarSeating({ seated, seatAvatar, clearSeats, autoSeat }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <SectionTitle>Demo Avatars</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {DEMO_AVATARS.map((av) => {
            const isSeated = seated.some((s) => s.id === av.id);
            return (
              <div key={av.id} onClick={() => !isSeated && seatAvatar(av)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, cursor: isSeated ? "default" : "pointer",
                background: isSeated ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSeated ? "rgba(52,199,89,0.3)" : "rgba(255,255,255,0.08)"}`,
                opacity: isSeated ? 0.6 : 1, transition: "all 0.2s",
              }} data-testid={`avatar-seat-${av.id}`}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{av.initials}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{av.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{av.role}</div>
                </div>
                {isSeated && <span style={{ marginLeft: "auto", fontSize: 11, color: "#34C759", fontWeight: 600 }}>Seated</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={autoSeat} style={actionBtn("#007AFF")} data-testid="auto-seat-btn"><Users size={14} /> Auto-seat Demo Group</button>
          <button onClick={clearSeats} style={actionBtn("#FF3B30")} data-testid="clear-seats-btn"><RotateCcw size={14} /> Clear Seats</button>
        </div>
      </div>

      {/* Table with seats */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 340, height: 340 }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 160, height: 160, borderRadius: "50%",
            background: "linear-gradient(135deg, #8b5e3c, #6b3a1f)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)",
          }} />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 - 90) * (Math.PI / 180);
            const x = 170 + 130 * Math.cos(angle) - 24;
            const y = 170 + 130 * Math.sin(angle) - 24;
            const av = seated[i];
            return (
              <div key={`gather-seat-${i}`} style={{
                position: "absolute", left: x, top: y,
                width: 48, height: 48, borderRadius: "50%",
                background: av ? av.color : "rgba(255,255,255,0.06)",
                border: av ? "2px solid rgba(255,255,255,0.3)" : "2px dashed rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: av ? 13 : 10, fontWeight: 700, color: av ? "#fff" : "rgba(255,255,255,0.2)",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: av ? "scale(1)" : "scale(0.85)",
              }}>
                {av ? av.initials : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  3. LIVE TABLE VIEW
// ══════════════════════════════════════════════
function LiveTableView({ config, seated, simRunning, simStep, setSimStep, setSimRunning, setTab, autoSeat }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [aiSummary, setAiSummary] = useState("");

  // Simulation engine
  useEffect(() => {
    if (!simRunning) return;
    const SIM_STEPS = [
      { delay: 2000, action: () => {} },
      { delay: 3000, action: () => {} },
      { delay: 3000, action: () => {} },
      { delay: 3000, action: () => {} },
      { delay: 2500, action: () => autoSeat() },
      { delay: 3000, action: () => setChatMessages([{ from: "Chris", text: "Tonight we are looking at the launch path for MICRO and The Gather App.", color: "#007AFF" }]) },
      { delay: 4000, action: () => setChatMessages((p) => [...p, { from: "Roy", text: "This makes the product immediately understandable. People can see the gathering before they use it.", color: "#FF9500" }]) },
      { delay: 3500, action: () => setChatMessages((p) => [...p, { from: "Chef Simone", text: "Chef Table service is staged and ready.", color: "#FFCC00" }]) },
      { delay: 3500, action: () => setChatMessages((p) => [...p, { from: "PM Lee", text: "Action items: finalize naming, prepare investor demo, define v1 feature set.", color: "#5AC8FA" }]) },
      { delay: 3000, action: () => setAiSummary("MICRO demo complete. Key value: configurable rooms, table settings, seated avatars, ambiance, service layer, and group tools in one visual gathering space.") },
      { delay: 4000, action: () => {} },
    ];

    if (simStep >= SIM_STEPS.length) { setSimRunning(false); return; }

    const timer = setTimeout(() => {
      SIM_STEPS[simStep].action();
      setSimStep((s) => s + 1);
    }, SIM_STEPS[simStep].delay);

    return () => clearTimeout(timer);
  }, [simRunning, simStep, setSimStep, setSimRunning, autoSeat]);

  const SIM_LABELS = [
    'Host creates "Partner Strategy Dinner"',
    "Selects Skyline Executive Room + Mahogany Table",
    "Sets formal dinner with notebooks and pens",
    "Chooses Warm Dinner lighting + Soft Jazz",
    "Auto-seating avatars...",
    "Chris opens the conversation...",
    "Roy responds with vision...",
    "Chef Simone confirms service...",
    "PM Lee logs action items...",
    "AI Summary generating...",
    "MICRO: Choose the room. Set the table. Seat the people. Shape the gathering.",
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* Room background */}
      <div style={{
        borderRadius: 20, overflow: "hidden", position: "relative",
        minHeight: 520, background: config.room.gradient,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ position: "absolute", inset: 0, background: config.ambiance.overlay }} />

        {/* Ambient labels */}
        <div style={{ position: "absolute", top: 16, left: 20, display: "flex", gap: 8 }}>
          <GlassChip label={config.ambiance.name} dot={config.ambiance.color} />
          <GlassChip label={config.music.name} />
          <GlassChip label={config.food.name} />
        </div>

        {/* Sim progress */}
        {simRunning && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", borderRadius: 12,
            padding: "10px 20px", maxWidth: 500, textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Step {simStep + 1} of 11</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{SIM_LABELS[simStep] || "..."}</div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 8 }}>
              <div style={{ height: "100%", borderRadius: 2, background: "#007AFF", width: `${((simStep + 1) / 11) * 100}%`, transition: "width 0.5s" }} />
            </div>
          </div>
        )}

        {/* Table + avatars */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420, paddingTop: 60 }}>
          {/* Table */}
          <div style={{
            width: 220, height: 220, borderRadius: "50%",
            background: config.table.wood,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            position: "relative",
          }}>
            <span style={{ fontSize: 32 }}>{config.tabletop.icon}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{config.tabletop.name}</span>
          </div>

          {/* Seated avatars encircling the table */}
          {seated.map((av, i) => {
            const angle = (i * (360 / Math.max(seated.length, 1)) - 90) * (Math.PI / 180);
            const x = 150 * Math.cos(angle);
            const y = 150 * Math.sin(angle);
            return (
              <div key={av.id} style={{
                position: "absolute",
                left: `calc(50% + ${x}px - 28px)`,
                top: `calc(50% + ${y}px - 28px + 30px)`,
                animation: "fadeScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: av.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#fff",
                  border: "3px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                }}>{av.initials}</div>
                <div style={{ textAlign: "center", fontSize: 10, marginTop: 4, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{av.name}</div>
              </div>
            );
          })}
        </div>

        {/* Side tool panel */}
        <div style={{
          position: "absolute", right: 16, top: 60, bottom: 16,
          width: 52, display: "flex", flexDirection: "column", gap: 6,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(16px)",
          borderRadius: 14, padding: "10px 6px", alignItems: "center",
        }}>
          {[
            { icon: <MessageSquare size={18} />, label: "Chat" },
            { icon: <Mic size={18} />, label: "Voice" },
            { icon: <File size={18} />, label: "Files" },
            { icon: <Calendar size={18} />, label: "Calendar" },
            { icon: <UtensilsCrossed size={18} />, label: "Menu" },
            { icon: <StickyNote size={18} />, label: "Notes" },
            { icon: <Sparkles size={18} />, label: "AI" },
            { icon: <Link2 size={18} />, label: "Invite" },
          ].map((t) => (
            <div key={t.label} title={t.label} style={{
              width: 40, height: 40, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.6)", cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}>{t.icon}</div>
          ))}
        </div>
      </div>

      {/* Chat bubbles overlay */}
      {chatMessages.length > 0 && (
        <div style={{
          position: "absolute", bottom: 80, left: 20, width: 360,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {chatMessages.map((m) => (
            <div key={m.id} style={{
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)",
              borderRadius: 14, padding: "10px 14px", borderLeft: `3px solid ${m.color}`,
              animation: "fadeScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.from}</div>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: "rgba(255,255,255,0.9)" }}>{m.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary overlay */}
      {aiSummary && (
        <div style={{
          position: "absolute", bottom: 80, right: 80, width: 380,
          background: "rgba(0,122,255,0.15)", backdropFilter: "blur(16px)",
          borderRadius: 14, padding: 16, border: "1px solid rgba(0,122,255,0.3)",
          animation: "fadeScaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5AC8FA", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> AI Summary</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}>{aiSummary}</div>
        </div>
      )}

      {/* Bottom control bar */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 10, marginTop: 16,
      }}>
        {!simRunning && (
          <>
            <button onClick={() => { setSimRunning(true); setSimStep(0); setChatMessages([]); setAiSummary(""); autoSeat(); }} style={actionBtn("#007AFF")} data-testid="live-start-sim"><Play size={14} /> Start Simulation</button>
            <button onClick={() => setTab("builder")} style={actionBtn("rgba(255,255,255,0.1)")}><Settings2 size={14} /> Change Room</button>
            <button onClick={() => setTab("seats")} style={actionBtn("rgba(255,255,255,0.1)")}><UserPlus size={14} /> Add Guest</button>
            <button style={actionBtn("rgba(255,255,255,0.1)")}><Save size={14} /> Save Gathering</button>
            <button style={actionBtn("#FF3B30")}><X size={14} /> End Gathering</button>
          </>
        )}
        {simRunning && (
          <button onClick={() => { setSimRunning(false); }} style={actionBtn("#FF3B30")}><X size={14} /> Stop Demo</button>
        )}
      </div>

      {/* Final screen */}
      {!simRunning && simStep >= 11 && (
        <div style={{
          marginTop: 24, textAlign: "center", padding: "40px 20px",
          background: "rgba(255,255,255,0.03)", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>MICRO</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 8, lineHeight: 1.6 }}>
            Choose the room. Set the table. Seat the people. Shape the gathering.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  4. EXPLORE GRID
// ══════════════════════════════════════════════
function ExploreGrid() {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>What MICRO Can Become</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {EXPLORE_CARDS.map((c) => (
          <div key={c.name} style={{
            borderRadius: 16, overflow: "hidden",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s",
            cursor: "pointer",
          }}>
            <div style={{ height: 100, background: c.gradient, display: "flex", alignItems: "flex-end", padding: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{c.name}</span>
            </div>
            <div style={{ padding: 14 }}>
              <InfoRow label="Room" value={c.room} />
              <InfoRow label="Table" value={c.table} />
              <InfoRow label="Tabletop" value={c.tabletop} />
              <InfoRow label="Ambiance" value={c.ambiance} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  5. PRICING PREVIEW
// ══════════════════════════════════════════════
function PricingPreview() {
  const plans = [
    { name: "Free", price: "$0", features: ["1 room", "Basic table", "Simple avatar seating", "3 members max"], color: "#8E8E93" },
    { name: "Pro", price: "$12/mo", features: ["All rooms", "Ambiance controls", "Table presets", "Files, Calendar, Notes", "Unlimited members"], color: "#007AFF", popular: true },
    { name: "Premium", price: "$29/mo", features: ["Chef Table experience", "Private event rooms", "Branded rooms", "Advanced AI Summary", "Priority support"], color: "#AF52DE" },
    { name: "Organization", price: "Custom", features: ["Teams & ministries", "Community groups", "Admin tools", "Templates library", "Dedicated support"], color: "#FF9500" },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Plans Preview</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Subscriptions TBD — this is a preview of the planned tiers.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {plans.map((p) => (
          <div key={p.name} style={{
            padding: 24, borderRadius: 16,
            background: p.popular ? "rgba(0,122,255,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${p.popular ? "rgba(0,122,255,0.3)" : "rgba(255,255,255,0.08)"}`,
            position: "relative",
          }}>
            {p.popular && <div style={{ position: "absolute", top: -10, right: 16, padding: "4px 12px", borderRadius: 8, background: "#007AFF", color: "#fff", fontSize: 10, fontWeight: 700 }}>POPULAR</div>}
            <div style={{ fontSize: 12, fontWeight: 600, color: p.color, textTransform: "uppercase", letterSpacing: 1 }}>{p.name}</div>
            <div style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 16px" }}>{p.price}</div>
            {p.features.map((f) => (
              <div key={f} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: p.color }}>+</span> {f}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  6. DEMO NOTES
// ══════════════════════════════════════════════
function DemoNotes() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Investor / Partner Demo Notes</h2>
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
        <p><strong style={{ color: "#fff" }}>This is a visual prototype.</strong></p>
        <p>Real-time communication, voice, ordering, and avatar engine are simulated in this demo to show product vision.</p>
        <p><strong style={{ color: "#fff" }}>Goal:</strong> Show the product vision and one complete user journey — from room setup to a live gathering with chat, AI summaries, and service layers.</p>
        <p><strong style={{ color: "#fff" }}>Production build would connect:</strong></p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Authentication & user management</li>
          <li>Real-time WebRTC communication</li>
          <li>Media streaming & recording</li>
          <li>Cloud storage for files & recordings</li>
          <li>Payment processing (Stripe)</li>
          <li>AI summarization (GPT/Claude)</li>
          <li>Push notifications & SMS bridges</li>
        </ul>
        <p style={{ marginTop: 16, color: "#FFCC00", fontWeight: 600 }}>MICRO is where your people gather. This demo proves the vision is real.</p>
      </div>
    </div>
  );
}

// ── Shared UI Components ─────────────────────
function SectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, margin: "20px 0 10px" }}>{children}</div>;
}

function CardGrid({ items, selected, onSelect, renderCard }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
      {items.map((item) => (
        <div key={item.id} onClick={() => onSelect(item)} style={{
          borderRadius: 14, overflow: "hidden", cursor: "pointer",
          border: selected?.id === item.id ? "2px solid #007AFF" : "2px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          transition: "border-color 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          transform: selected?.id === item.id ? "scale(1.02)" : "scale(1)",
        }}>
          {renderCard(item, selected?.id === item.id)}
        </div>
      ))}
    </div>
  );
}

function RadioPill({ label, selected, onClick, dot }) {
  return (
    <div onClick={onClick} style={{
      padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, marginBottom: 4,
      background: selected ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${selected ? "rgba(0,122,255,0.3)" : "rgba(255,255,255,0.06)"}`,
      color: selected ? "#fff" : "rgba(255,255,255,0.6)",
      display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
    }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 4, background: dot }} />}
      {label}
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ fontSize: 11, display: "flex", gap: 6, padding: "2px 0" }}>
      <span style={{ color: "rgba(255,255,255,0.4)", width: 60 }}>{label}</span>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{value}</span>
    </div>
  );
}

function GlassChip({ label, dot }) {
  return (
    <div style={{
      padding: "5px 12px", borderRadius: 20,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)",
      fontSize: 11, color: "rgba(255,255,255,0.7)",
      display: "flex", alignItems: "center", gap: 6,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />}
      {label}
    </div>
  );
}

const actionBtn = (bg) => ({
  padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer",
  background: bg, color: "#fff", fontSize: 13, fontWeight: 600,
  display: "flex", alignItems: "center", gap: 6,
  transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
});

// ══════════════════════════════════════════════
//  SHARE MODAL — investor-ready demo links
// ══════════════════════════════════════════════
function ShareModal({ onClose, initialName }) {
  const [name, setName] = useState(initialName || "");
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}/gather`;
    return name.trim() ? `${base}?for=${encodeURIComponent(name.trim())}` : base;
  }, [name]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Demo link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Couldn't copy — select & copy manually");
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeScaleIn 0.2s ease-out",
    }} data-testid="gather-share-modal">
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 460, maxWidth: "92vw", padding: 28, borderRadius: 20,
        background: "linear-gradient(135deg, #1a1a1c 0%, #0f0f10 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,204,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} color="#FFCC00" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Share Demo Link</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Personalize and copy a one-click investor link</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer", padding: 6,
            color: "rgba(255,255,255,0.5)", borderRadius: 8,
          }} data-testid="gather-share-close">
            <X size={18} />
          </button>
        </div>

        <div style={{ marginTop: 22 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Partner / Investor Name (optional)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Roy, Pastor Dana, Acme Ventures"
            data-testid="gather-share-name-input"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#5AC8FA"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
            They&apos;ll see &quot;Built for {name.trim() || "[name]"}&quot; in the demo header.
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Demo URL
          </label>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12,
            background: "rgba(0,122,255,0.08)", border: "1px solid rgba(0,122,255,0.25)",
          }}>
            <Link2 size={14} color="#5AC8FA" />
            <span data-testid="gather-share-url" style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-mono, monospace)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shareUrl}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={handleCopy} data-testid="gather-share-copy" style={{
            flex: 1, padding: "12px 18px", borderRadius: 12, border: "none", cursor: "pointer",
            background: copied ? "#34C759" : "linear-gradient(135deg, #007AFF, #5AC8FA)",
            color: "#fff", fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.25s",
          }}>
            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy Link</>}
          </button>
          <button onClick={onClose} style={{
            padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
            background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500,
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
