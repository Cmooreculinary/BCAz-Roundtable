import React, { useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Eye,
  LayoutGrid,
  Music2,
  Radio,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  AMBIANCES,
  AUDIENCE_ACTIONS,
  DEFAULT_SCENE,
  FOODS,
  MUSICS,
  ROOMS,
  SEAT_COUNTS,
  TABLE_GESTURES,
  TABLES,
  TABLETOPS,
  VENUES,
  isStageVenue,
  seatCountForTable,
  stageLayoutFor,
} from "../../lib/scenes";
import { PORTRAIT_SEEDS, portraitDataUri } from "../../lib/avatars";
import RoundTableViz from "../rt/RoundTableViz";
import StageViz from "../rt/StageViz";
import "../../styles/scene-editor.css";

const VENUE_NOTES = {
  skyline: "City lights · private focus",
  dining: "Warm home · garden light",
  studio: "Open water · natural light",
  library: "Walnut · leather · firelight",
  church: "Timber · snow · hearth",
  terrace: "Open air · garden atmosphere",
  theatre: "Tiered house · lit stage · large screen",
  redrocks: "Monoliths · night sky · open-air bowl",
  arena: "Full bowl · big screens · stadium crowd",
};

const TABLE_NOTES = {
  mahogany: "Classic round",
  executive: "Formal boardroom",
  family: "Relaxed gathering",
  drafting: "Working session",
  luncheon: "Light service",
  strategy: "Command center",
};

const FOOD_ICONS = { none: "—", coffee: "☕", snacks: "🥨", hors: "🥂", lunch: "🥗", dinner: "🍽", chef: "♨" };
const MUSIC_ICONS = { off: "—", jazz: "♬", acoustic: "♩", ambient: "◌", worship: "✦", event: "♫" };

const TABS = [
  { id: "view", label: "View", icon: <Eye size={15} /> },
  { id: "seating", label: "Seating", icon: <Users size={15} /> },
  { id: "stage", label: "Stage", icon: <LayoutGrid size={15} /> },
  { id: "avatars", label: "Avatars", icon: <UserRound size={15} /> },
  { id: "ambiance", label: "Ambiance", icon: <Sparkles size={15} /> },
  { id: "sound", label: "Sound", icon: <Music2 size={15} /> },
];

const CAPABILITIES = [
  { icon: <Boxes size={15} />, text: "Design immersive roundtable and stage experiences." },
  { icon: <Users size={15} />, text: "Configure venues, seats, and avatars." },
  { icon: <SlidersHorizontal size={15} />, text: "Control ambiance, sound, and stage." },
  { icon: <Radio size={15} />, text: "Engage your audience in real time." },
];

const PRESENTER_CONTROLS = [
  { title: "Manage Content", detail: "Upload slides, videos, and media." },
  { title: "Moderation Tools", detail: "Manage attendees and permissions." },
  { title: "Stage & Layout", detail: "Adjust stage, screens, and lighting." },
];

/**
 * SceneEditor — the experience studio.
 *
 * The preview is not a diagram of the room, it *is* the room: the same
 * RoundTableViz and StageViz components the live table renders, fed a rehearsal
 * cast. Whatever you see while designing is what opens when guests arrive.
 * Scene IDs remain the backend contract.
 */
export function SceneEditor({ value, onChange, seatRoster = true }) {
  const scene = useMemo(() => ({ ...DEFAULT_SCENE, ...(value || {}) }), [value]);
  const [tab, setTab] = useState("view");
  const update = (key, nextValue) => onChange?.({ ...scene, [key]: nextValue });
  const reset = () => onChange?.({ ...DEFAULT_SCENE });

  const stage = isStageVenue(scene.room);
  const layout = stageLayoutFor(scene.room);
  const seatCount = stage ? layout.capacity : SEAT_COUNTS[scene.table] || 8;

  const resolved = {
    venue: VENUES.find((item) => item.id === scene.room) || ROOMS[0],
    table: TABLES.find((item) => item.id === scene.table) || TABLES[0],
    tabletop: TABLETOPS.find((item) => item.id === scene.tabletop) || TABLETOPS[0],
    food: FOODS.find((item) => item.id === scene.food) || FOODS[0],
    ambiance: AMBIANCES.find((item) => item.id === scene.ambiance) || AMBIANCES[0],
    music: MUSICS.find((item) => item.id === scene.music) || MUSICS[0],
  };

  // A rehearsal cast, so the preview is never an empty room.
  const rehearsal = useMemo(() => buildRehearsalTable(scene, stage), [scene, stage]);
  const actions = stage ? AUDIENCE_ACTIONS : TABLE_GESTURES;

  return (
    <div className="venue-studio" data-testid="scene-editor">
      <div className="venue-studio__tabs" role="tablist" aria-label="Experience settings">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`venue-tab${tab === item.id ? " is-active" : ""}`}
            onClick={() => setTab(item.id)}
            data-testid={`venue-tab-${item.id}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="venue-studio__main">
        <div className="venue-studio__canvas">
          <div className="venue-preview" data-testid="scene-preview">
            <div className="venue-preview__bar">
              <span className="venue-preview__mode">
                <Eye size={13} aria-hidden="true" />
                <strong>Preview Mode:</strong> Live view of your {stage ? "stage" : "roundtable"} experience
              </span>
              <span className="venue-preview__live"><i />LIVE</span>
            </div>
            <div className="venue-preview__frame">
              {stage ? (
                <StageViz table={rehearsal} currentUserId={rehearsal.members[1]?.id} gestures={rehearsal.gestures} />
              ) : (
                <RoundTableViz table={rehearsal} seats={rehearsal.seats} currentUserId={rehearsal.members[0]?.id} gestures={rehearsal.gestures} />
              )}
            </div>
          </div>

          {/* The roster strip belongs to stage venues. At a table, guests are
              shown in their chairs — there is no reason to line them up below. */}
          {stage && seatRoster && (
            <div className="venue-roster" data-testid="venue-roster">
              <span className="venue-roster__count"><Users size={14} /> Seats: <strong>{seatCount}</strong></span>
              <div className="venue-roster__faces">
                {PORTRAIT_SEEDS.slice(0, 12).map((seed) => (
                  <img key={seed} src={portraitDataUri(seed)} alt="" loading="lazy" />
                ))}
                <span className="venue-roster__more">+{Math.max(0, seatCount - 12)}</span>
              </div>
              <span className="venue-roster__hint">{layout.label} · {layout.rows.length} rows</span>
            </div>
          )}

          <div className="venue-actions-preview">
            <div className="venue-actions-preview__copy">
              <strong>{stage ? "Audience Interactions" : "Table Gestures"}</strong>
              <small>{stage ? "What every guest in the house can play from their seat." : "What guests can play from their chair."}</small>
            </div>
            <div className="venue-actions-preview__grid">
              {actions.map((action) => (
                <span key={action.id} className="venue-action-chip">
                  <i aria-hidden="true">{action.mark}</i>
                  {action.label}
                </span>
              ))}
            </div>
          </div>

          <RailSection number="04" title="Ambiance" hidden={tab !== "ambiance"}>
            <OptionRow items={AMBIANCES} value={scene.ambiance} onChange={(id) => update("ambiance", id)} testPrefix="scene-ambiance" mark={(item) => <i className="venue-swatch" style={{ background: item.color }} />} />
          </RailSection>

          <RailSection number="05" title="Sound" hidden={tab !== "sound"}>
            <OptionRow items={MUSICS} value={scene.music} onChange={(id) => update("music", id)} testPrefix="scene-music" mark={(item) => MUSIC_ICONS[item.id]} />
          </RailSection>

          <RailSection number="02" title={stage ? "House & table" : "Table & seating"} hidden={tab !== "seating"}>
            {stage && (
              <p className="venue-note">
                {resolved.venue.name} seats {layout.capacity} across {layout.rows.length} curved rows. Guests are placed
                nearest the stage as they arrive; the table below is used if this experience is switched back to a room.
              </p>
            )}
            <div className="venue-card-grid">
              {TABLES.map((table) => (
                <ChoiceCard
                  key={table.id}
                  selected={scene.table === table.id}
                  onClick={() => update("table", table.id)}
                  testId={`scene-table-${table.id}`}
                  label={`${table.name}, ${SEAT_COUNTS[table.id]} seats`}
                  className="venue-table-card"
                >
                  <span className="venue-table-card__art">
                    <img src={table.image} alt="" />
                    <em>{SEAT_COUNTS[table.id]}</em>
                  </span>
                  <ChoiceCopy title={table.name} detail={`${TABLE_NOTES[table.id]} · ${seatCountForTable(table.id)} seats`} selected={scene.table === table.id} />
                </ChoiceCard>
              ))}
            </div>
          </RailSection>

          <RailSection number="03" title="Stage & service" hidden={tab !== "stage"}>
            <div className="venue-card-grid">
              {TABLETOPS.map((tabletop) => (
                <ChoiceCard
                  key={tabletop.id}
                  selected={scene.tabletop === tabletop.id}
                  onClick={() => update("tabletop", tabletop.id)}
                  testId={`scene-tabletop-${tabletop.id}`}
                  label={tabletop.name}
                  className="venue-tabletop-card"
                >
                  <span className="venue-tabletop-card__icon" aria-hidden="true">{tabletop.icon}</span>
                  <ChoiceCopy title={tabletop.name} detail={tabletop.desc} selected={scene.tabletop === tabletop.id} />
                </ChoiceCard>
              ))}
            </div>
            <OptionRow items={FOODS} value={scene.food} onChange={(id) => update("food", id)} testPrefix="scene-food" mark={(item) => FOOD_ICONS[item.id]} />
          </RailSection>

          <RailSection number="06" title="Avatars" hidden={tab !== "avatars"}>
            <p className="venue-note">
              Every guest is drawn in the roundtable portrait style — tailored, warm-lit, and readable at any seat.
              Guests choose their own face from Settings; these are the current set.
            </p>
            <div className="venue-avatar-strip">
              {PORTRAIT_SEEDS.map((seed) => (
                <img key={seed} src={portraitDataUri(seed)} alt="" loading="lazy" />
              ))}
            </div>
          </RailSection>

          <RailSection number="01" title="Selected experience" hidden={tab !== "view"}>
            <div className="venue-summary" data-testid="scene-selection-summary">
              <div>
                <span>Selected venue</span>
                <strong>{resolved.venue.name}</strong>
              </div>
              <span>{stage ? layout.label : resolved.table.name}</span>
              <span>{seatCount} seats</span>
              <span>{resolved.tabletop.name}</span>
              <span>{resolved.food.name}</span>
              <span>{resolved.ambiance.name}</span>
              <span>{resolved.music.name}</span>
            </div>
            <p className="venue-note">{resolved.venue.description}</p>
          </RailSection>
        </div>

        <aside className="venue-studio__rail">
          <section className="venue-rail-block">
            <header>
              <h3><b>1.</b> Scene &amp; Venue Settings</h3>
              <p>Choose the environment and layout.</p>
              <button type="button" className="venue-reset" onClick={reset} data-testid="scene-reset">
                <RotateCcw size={12} aria-hidden="true" /> Reset scene
              </button>
            </header>
            <div className="venue-rail-list">
              {VENUES.map((venue) => (
                <button
                  key={venue.id}
                  type="button"
                  className={`venue-rail-card${scene.room === venue.id ? " is-selected" : ""}`}
                  onClick={() => update("room", venue.id)}
                  data-testid={`scene-room-${venue.id}`}
                  aria-pressed={scene.room === venue.id}
                >
                  <span className="venue-rail-card__art" style={{ backgroundImage: `url("${venue.image}")` }}>
                    {scene.room === venue.id && <i className="venue-rail-card__check"><Check size={12} /></i>}
                  </span>
                  <span className="venue-rail-card__copy">
                    <strong>{venue.name}</strong>
                    <small>{venue.description}</small>
                    <em className={scene.room === venue.id ? "is-active" : ""}>
                      {scene.room === venue.id ? "Active" : VENUE_NOTES[venue.id]}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="venue-rail-block">
            <header>
              <h3><b>2.</b> Instructions &amp; Capabilities</h3>
            </header>
            <ul className="venue-capabilities">
              {CAPABILITIES.map((item) => (
                <li key={item.text}>{item.icon}<span>{item.text}</span></li>
              ))}
            </ul>
          </section>

          <section className="venue-rail-block">
            <header>
              <h3><b>3.</b> Presenter Controls</h3>
            </header>
            <ul className="venue-controls">
              {PRESENTER_CONTROLS.map((item) => (
                <li key={item.title}>
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  <i aria-hidden="true">›</i>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function SceneEditorModal({ initial, onSave, onClose }) {
  const [scene, setScene] = useState({ ...DEFAULT_SCENE, ...(initial || {}) });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave?.(scene);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop scene-modal-backdrop" onClick={onClose} data-testid="scene-editor-modal">
      <div className="modal scene-modal" onClick={(event) => event.stopPropagation()}>
        <header className="scene-modal__header">
          <span className="scene-modal__lights" aria-hidden="true"><i /><i /><i /></span>
          <div className="scene-modal__title">
            <h2>Round Table</h2>
            <p>Design immersive theatre, speaking, and presentation experiences.</p>
          </div>
          <button className="scene-modal__close" onClick={onClose} data-testid="scene-editor-close" aria-label="Close scene editor">
            <X size={17} />
          </button>
        </header>

        <div className="scene-modal__body">
          <SceneEditor value={scene} onChange={setScene} />
        </div>

        <footer className="scene-modal__footer">
          <button type="button" className="btn btn-ghost" onClick={() => setScene({ ...DEFAULT_SCENE })} data-testid="scene-reset-footer">
            <RotateCcw size={14} /> Reset to Defaults
          </button>
          <div className="scene-modal__broadcast">
            <span className="scene-modal__broadcast-mark"><Settings2 size={16} /></span>
            <span>
              <strong>Ready to Broadcast</strong>
              <small>Your experience is configured and ready.</small>
            </span>
          </div>
          <div className="scene-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary scene-modal__save" onClick={handleSave} disabled={busy} data-testid="scene-editor-save">
              <Check size={14} /> {busy ? "Saving…" : "Save Experience"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * A cast for the preview. Real rooms fill with real people; the studio fills
 * with the portrait set so the designer sees a populated room rather than an
 * empty one, including a couple of live gestures.
 */
function buildRehearsalTable(scene, stage) {
  const cast = PORTRAIT_SEEDS.slice(0, stage ? 9 : seatCountForTable(scene.table));
  const members = cast.map((seed, index) => ({
    id: `rehearsal-${index}`,
    name: seed,
    initials: seed.slice(0, 2).toUpperCase(),
    color: "#C9954E",
    status: index % 3 === 0 ? "online" : "offline",
    avatar_url: `rtp:v1:${seed}`,
  }));

  return {
    id: "rehearsal",
    name: "Round Table",
    active: true,
    created_by: members[0]?.id,
    scene,
    members,
    items: [],
    events: [],
    seats: members.map((m, index) => ({ seat_index: index, user_id: m.id })),
    gestures: {
      [members[2]?.id]: "clap",
      [members[4]?.id]: stage ? "stand" : "hands_up",
      [members[6]?.id]: "fist_raised",
    },
  };
}

function RailSection({ number, title, hidden, children }) {
  return (
    <section className="venue-panel" hidden={hidden}>
      <header><span>{number}</span><h3>{title}</h3></header>
      {children}
    </section>
  );
}

function ChoiceCard({ selected, onClick, testId, label, className, children }) {
  return (
    <button
      type="button"
      className={`venue-choice ${className || ""}${selected ? " is-selected" : ""}`}
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

function ChoiceCopy({ title, detail, selected }) {
  return (
    <span className="venue-choice__copy">
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="venue-choice__check" aria-hidden="true">{selected && <Check size={12} />}</span>
    </span>
  );
}

function OptionRow({ items, value, onChange, testPrefix, mark }) {
  return (
    <div className="venue-option-row">
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`venue-option${selected ? " is-selected" : ""}`}
            onClick={() => onChange(item.id)}
            data-testid={`${testPrefix}-${item.id}`}
            aria-pressed={selected}
          >
            <span className="venue-option__mark" aria-hidden="true">{mark(item)}</span>
            <span>{item.name}</span>
            {selected && <Check size={11} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
