import React, { useState } from "react";
import {
  Armchair,
  Check,
  Eye,
  Music2,
  RotateCcw,
  Settings2,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  AMBIANCES,
  DEFAULT_SCENE,
  FOODS,
  MUSICS,
  ROOMS,
  SEAT_COUNTS,
  TABLES,
  TABLETOPS,
} from "../../lib/scenes";
import "../../styles/scene-editor.css";

const ROOM_NOTES = {
  skyline: "City lights · executive focus",
  dining: "Warm wood · private service",
  studio: "Open plan · creative energy",
  library: "Firelight · quiet conversation",
  church: "Community scale · shared purpose",
  terrace: "Open air · garden atmosphere",
};

const TABLE_NOTES = {
  mahogany: "Classic round",
  executive: "Formal boardroom",
  family: "Relaxed gathering",
  drafting: "Working session",
  luncheon: "Light service",
  strategy: "Command center",
};

const FOOD_ICONS = {
  none: "—",
  coffee: "☕",
  snacks: "🥨",
  hors: "🥂",
  lunch: "🥗",
  dinner: "🍽",
  chef: "♨",
};

const MUSIC_ICONS = {
  off: "—",
  jazz: "♬",
  acoustic: "♩",
  ambient: "◌",
  worship: "✦",
  event: "♫",
};

/**
 * SceneEditor is the shared controlled scene-selection studio used by table
 * creation and existing-table editing. Scene IDs remain the backend contract.
 */
export function SceneEditor({ value, onChange }) {
  const scene = { ...DEFAULT_SCENE, ...(value || {}) };
  const update = (key, nextValue) => onChange?.({ ...scene, [key]: nextValue });
  const reset = () => onChange?.({ ...DEFAULT_SCENE });
  const seatCount = SEAT_COUNTS[scene.table] || 8;

  const resolved = {
    room: ROOMS.find((item) => item.id === scene.room) || ROOMS[0],
    table: TABLES.find((item) => item.id === scene.table) || TABLES[0],
    tabletop: TABLETOPS.find((item) => item.id === scene.tabletop) || TABLETOPS[0],
    food: FOODS.find((item) => item.id === scene.food) || FOODS[0],
    ambiance: AMBIANCES.find((item) => item.id === scene.ambiance) || AMBIANCES[0],
    music: MUSICS.find((item) => item.id === scene.music) || MUSICS[0],
  };

  return (
    <div className="scene-studio" data-testid="scene-editor">
      <div className="scene-studio__utility">
        <div>
          <span className="scene-studio__eyebrow">Scene studio</span>
          <strong>Build the gathering</strong>
        </div>
        <button type="button" className="scene-reset" onClick={reset} data-testid="scene-reset">
          <RotateCcw size={13} aria-hidden="true" /> Reset scene
        </button>
      </div>

      <ScenePreview scene={scene} resolved={resolved} seatCount={seatCount} />

      <SelectionSection
        number="01"
        icon={<Eye size={16} />}
        title="View"
        description="Choose the atmosphere surrounding your table."
      >
        <div className="scene-card-grid scene-card-grid--rooms">
          {ROOMS.map((room) => (
            <ChoiceCard
              key={room.id}
              selected={scene.room === room.id}
              onClick={() => update("room", room.id)}
              testId={`scene-room-${room.id}`}
              label={room.name}
              className="scene-room-card"
            >
              <div className={`scene-room-card__art scene-room-card__art--${room.id}`} style={{ background: room.gradient }}>
                <span className="scene-room-card__window" />
                <span className="scene-room-card__horizon" />
              </div>
              <ChoiceCopy title={room.name} detail={ROOM_NOTES[room.id]} selected={scene.room === room.id} />
            </ChoiceCard>
          ))}
        </div>
      </SelectionSection>

      <SelectionSection
        number="02"
        icon={<Armchair size={16} />}
        title="Table"
        description="Select the table; its seating layout follows automatically."
      >
        <div className="scene-card-grid scene-card-grid--tables">
          {TABLES.map((table) => (
            <ChoiceCard
              key={table.id}
              selected={scene.table === table.id}
              onClick={() => update("table", table.id)}
              testId={`scene-table-${table.id}`}
              label={`${table.name}, ${SEAT_COUNTS[table.id]} seats`}
              className="scene-table-card"
            >
              <div className="scene-table-card__art">
                <span className={`scene-table-card__top scene-table-card__top--${table.id}`} style={{ background: table.wood }} />
                <span className="scene-table-card__seat-count">{SEAT_COUNTS[table.id]}</span>
              </div>
              <ChoiceCopy title={table.name} detail={`${TABLE_NOTES[table.id]} · ${SEAT_COUNTS[table.id]} seats`} selected={scene.table === table.id} />
            </ChoiceCard>
          ))}
        </div>
      </SelectionSection>

      <SelectionSection
        number="03"
        icon={<Sparkles size={16} />}
        title="Tabletop"
        description="Set the objects and service pieces guests see first."
      >
        <div className="scene-card-grid scene-card-grid--tabletops">
          {TABLETOPS.map((tabletop) => (
            <ChoiceCard
              key={tabletop.id}
              selected={scene.tabletop === tabletop.id}
              onClick={() => update("tabletop", tabletop.id)}
              testId={`scene-tabletop-${tabletop.id}`}
              label={tabletop.name}
              className="scene-tabletop-card"
            >
              <span className="scene-tabletop-card__icon" aria-hidden="true">{tabletop.icon}</span>
              <ChoiceCopy title={tabletop.name} detail={tabletop.desc} selected={scene.tabletop === tabletop.id} />
            </ChoiceCard>
          ))}
        </div>
      </SelectionSection>

      <div className="scene-studio__finishing-grid">
        <CompactSection
          number="04"
          icon={<UtensilsCrossed size={15} />}
          title="Service"
          items={FOODS}
          value={scene.food}
          onChange={(id) => update("food", id)}
          testPrefix="scene-food"
          renderMark={(item) => FOOD_ICONS[item.id]}
        />
        <CompactSection
          number="05"
          icon={<Sparkles size={15} />}
          title="Ambiance"
          items={AMBIANCES}
          value={scene.ambiance}
          onChange={(id) => update("ambiance", id)}
          testPrefix="scene-ambiance"
          renderMark={(item) => <span className="scene-option__swatch" style={{ background: item.color }} />}
        />
        <CompactSection
          number="06"
          icon={<Music2 size={15} />}
          title="Sound"
          items={MUSICS}
          value={scene.music}
          onChange={(id) => update("music", id)}
          testPrefix="scene-music"
          renderMark={(item) => MUSIC_ICONS[item.id]}
        />
      </div>

      <div className="scene-summary" data-testid="scene-selection-summary">
        <div>
          <span className="scene-summary__label">Selected scene</span>
          <strong>{resolved.room.name}</strong>
        </div>
        <span>{resolved.table.name}</span>
        <span>{seatCount} seats</span>
        <span>{resolved.tabletop.name}</span>
        <span>{resolved.food.name}</span>
        <span>{resolved.ambiance.name}</span>
        <span>{resolved.music.name}</span>
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
          <div className="scene-modal__title-mark"><Settings2 size={18} /></div>
          <div>
            <span className="scene-studio__eyebrow">Roundtable experience</span>
            <h2>Customize scene</h2>
            <p>Choose the room. Set the table. Shape the gathering.</p>
          </div>
          <button className="scene-modal__close" onClick={onClose} data-testid="scene-editor-close" aria-label="Close scene editor">
            <X size={18} />
          </button>
        </header>
        <div className="scene-modal__body">
          <SceneEditor value={scene} onChange={setScene} />
        </div>
        <footer className="scene-modal__footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary scene-modal__save" onClick={handleSave} disabled={busy} data-testid="scene-editor-save">
            <Check size={14} /> {busy ? "Saving…" : "Save scene"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ScenePreview({ scene, resolved, seatCount }) {
  const seats = Array.from({ length: seatCount });

  return (
    <div className={`scene-preview scene-preview--${scene.room}`} data-testid="scene-preview" style={{ background: resolved.room.gradient }}>
      <div className="scene-preview__ambient" style={{ background: resolved.ambiance.overlay }} />
      <div className="scene-preview__architecture" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="scene-preview__caption">
        <span>Live preview</span>
        <strong>{resolved.room.name}</strong>
      </div>
      <div className="scene-preview__sound" aria-label={`Sound: ${resolved.music.name}`}>
        <Music2 size={13} /> {resolved.music.name}
      </div>
      <div className="scene-preview__floor" />
      <div className={`scene-preview__table scene-preview__table--${scene.table}`} style={{ background: resolved.table.wood }}>
        <span className="scene-preview__tabletop" aria-hidden="true">{resolved.tabletop.icon}</span>
        {seats.map((_, index) => {
          const angle = (360 / seatCount) * index - 90;
          return (
            <span
              key={`preview-seat-${index}`}
              className="scene-preview__seat"
              style={{ "--seat-angle": `${angle}deg`, "--seat-inverse-angle": `${angle * -1}deg` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <div className="scene-preview__service">
        <span>{FOOD_ICONS[resolved.food.id]}</span>
        <div><small>Service</small><strong>{resolved.food.name}</strong></div>
      </div>
      <div className="scene-preview__seating">
        <span>{seatCount}</span>
        <div><small>Seating</small><strong>Guest positions</strong></div>
      </div>
    </div>
  );
}

function SelectionSection({ number, icon, title, description, children }) {
  return (
    <section className="scene-section">
      <header className="scene-section__header">
        <span className="scene-section__number">{number}</span>
        <span className="scene-section__icon">{icon}</span>
        <div><h3>{title}</h3><p>{description}</p></div>
      </header>
      {children}
    </section>
  );
}

function ChoiceCard({ selected, onClick, testId, label, className, children }) {
  return (
    <button
      type="button"
      className={`scene-choice ${className || ""}${selected ? " is-selected" : ""}`}
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
    <span className="scene-choice__copy">
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="scene-choice__check" aria-hidden="true">{selected && <Check size={12} />}</span>
    </span>
  );
}

function CompactSection({ number, icon, title, items, value, onChange, testPrefix, renderMark }) {
  return (
    <section className="scene-compact-section">
      <header><span>{number}</span>{icon}<strong>{title}</strong></header>
      <div className="scene-compact-section__options">
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`scene-option${selected ? " is-selected" : ""}`}
              onClick={() => onChange(item.id)}
              data-testid={`${testPrefix}-${item.id}`}
              aria-pressed={selected}
            >
              <span className="scene-option__mark" aria-hidden="true">{renderMark(item)}</span>
              <span>{item.name}</span>
              <span className="scene-option__check" aria-hidden="true">{selected && <Check size={11} />}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
