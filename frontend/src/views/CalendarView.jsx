import React, { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import HelpTip from "../components/rt/HelpTip";
import { toast } from "sonner";
import { toLocalDateKey } from "../lib/dates";

export default function CalendarView({ onNew, tables = [] }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [filter, setFilter] = useState("all"); // all | tableId

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/events");
      setEvents(data || []);
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Could not load events");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteEvent = async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      toast.success("Event deleted");
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Could not delete event");
    }
  };

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const firstDay = new Date(cursor.year, cursor.month, 1).getDay();
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleString("en-US", { month: "long" });
  const today = toLocalDateKey();

  const filtered = filter === "all" ? events : events.filter((e) => e.table_id === filter);

  const eventsByDate = {};
  filtered.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, date });
  }

  const prevMonth = () => setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const nextMonth = () => setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
  const openDay = (date) => onNew?.(date);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <HelpTip section="calendar" text="All your group events, color-coded by table. Click a day to add one." />
      <div className="audit-page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Calendar</h1>
        <div className="audit-action-group">
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="cal-filter" aria-label="Filter calendar by table" style={{ width: 180 }}>
            <option value="all">All tables</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-primary" type="button" onClick={() => onNew?.()} data-testid="cal-new-btn"><Plus size={14} /> New Event</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{monthName} {cursor.year}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" type="button" onClick={prevMonth} aria-label="Previous month" data-testid="cal-prev"><ChevronLeft size={16} /></button>
            <button className="btn btn-ghost" type="button" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }} data-testid="cal-today">Today</button>
            <button className="btn btn-ghost" type="button" onClick={nextMonth} aria-label="Next month" data-testid="cal-next"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="calendar-scroll">
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, padding: 4 }}>{d}</div>
            ))}
          </div>

          <div className="cal-grid">
            {cells.map((c, i) => c === null ? <div key={`e-${i}`} /> : (
              <div
                key={c.date}
                className={`cal-cell calendar-day-button ${c.date === today ? "today" : ""}`}
                data-testid={`cal-cell-${c.date}`}
                role="button"
                tabIndex={0}
                aria-label={`Create an event on ${c.date}`}
                onClick={() => openDay(c.date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDay(c.date);
                  }
                }}
              >
                <div style={{ fontSize: 11, fontWeight: c.date === today ? 700 : 500, color: c.date === today ? "var(--mac-blue)" : "var(--text-primary)" }}>{c.d}</div>
                {(eventsByDate[c.date] || []).slice(0, 3).map((e) => (
                  <div key={e.id} className="cal-event" style={{ background: e.color || "#007AFF", display: "flex", alignItems: "center", gap: 2 }} title={`${e.title} · ${e.time}`}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={(event) => { event.stopPropagation(); deleteEvent(e.id); }}
                      aria-label={`Delete ${e.title}`}
                      data-testid={`cal-event-del-${e.id}`}
                      style={{ color: "#fff", opacity: 0.85, lineHeight: 1, padding: 1, minWidth: 18 }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {(eventsByDate[c.date] || []).length > 3 && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>+{eventsByDate[c.date].length - 3} more</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
