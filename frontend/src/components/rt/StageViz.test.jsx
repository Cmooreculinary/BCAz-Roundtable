import React, { act } from "react";
import { createRoot } from "react-dom/client";
import StageViz from "./StageViz";
import RoundTableViz from "./RoundTableViz";
import { AUDIENCE_ACTIONS, DEFAULT_SCENE, SEAT_COUNTS } from "../../lib/scenes";

const MEMBERS = Array.from({ length: 5 }, (_, i) => ({
  id: `member-${i}`,
  name: `Guest ${i}`,
  initials: `G${i}`,
  status: "online",
  avatar_url: `rtp:v1:Guest${i}`,
}));

function stageTable(room = "theatre") {
  return {
    id: "t1",
    name: "Keynote",
    active: true,
    created_by: MEMBERS[0].id,
    scene: { ...DEFAULT_SCENE, room },
    members: MEMBERS,
    items: [],
  };
}

describe("stage venues", () => {
  let container;
  let root;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("the house offers exactly the four audience actions", async () => {
    const onAction = jest.fn();
    await act(async () => {
      root.render(<StageViz table={stageTable()} currentUserId={MEMBERS[1].id} onAction={onAction} />);
    });

    const bar = container.querySelector('[data-testid="stage-action-bar"]');
    expect(bar).not.toBeNull();
    AUDIENCE_ACTIONS.forEach((action) => {
      expect(container.querySelector(`[data-testid="audience-${action.id}"]`)).not.toBeNull();
    });

    await act(async () => container.querySelector('[data-testid="audience-stand"]').click());
    expect(onAction).toHaveBeenCalledWith("stand");
  });

  test("a guest's live action drives their own figure, not the whole house", async () => {
    const gestures = { [MEMBERS[1].id]: "fist_raised" };
    await act(async () => {
      root.render(<StageViz table={stageTable()} currentUserId={MEMBERS[1].id} gestures={gestures} onAction={jest.fn()} />);
    });

    const mine = container.querySelector(`[data-testid="rt-house-${MEMBERS[1].id}"] .rt-fig`);
    expect(mine.getAttribute("class")).toContain("rt-fig--fist_raised");
    const other = container.querySelector(`[data-testid="rt-house-${MEMBERS[2].id}"] .rt-fig`);
    expect(other.getAttribute("class")).toContain("rt-fig--idle");
  });

  test.each(["theatre", "redrocks", "arena"])("%s renders a populated house", async (room) => {
    await act(async () => {
      root.render(<StageViz table={stageTable(room)} currentUserId={MEMBERS[1].id} />);
    });
    expect(container.querySelectorAll(".rt-aud").length).toBeGreaterThan(40);
    // The presenter holds the stage and is not doubled up in the audience.
    expect(container.querySelectorAll(`[data-testid="rt-house-${MEMBERS[0].id}"]`)).toHaveLength(0);
  });

  test("the action bar is omitted when the room is rendered read-only", async () => {
    await act(async () => {
      root.render(<StageViz table={stageTable()} currentUserId={MEMBERS[1].id} />);
    });
    expect(container.querySelector('[data-testid="stage-action-bar"]')).toBeNull();
  });
});

describe("table venues seat guests in their chairs", () => {
  let container;
  let root;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("a claimed seat holds a figure; an empty one stays claimable", async () => {
    const table = {
      id: "t2",
      name: "Board",
      active: true,
      scene: { ...DEFAULT_SCENE, table: "mahogany" },
      members: MEMBERS,
      items: [],
    };
    const seats = [{ seat_index: 0, user_id: MEMBERS[0].id }];
    const onClaimSeat = jest.fn();

    await act(async () => {
      root.render(
        <RoundTableViz table={table} seats={seats} currentUserId={MEMBERS[1].id} onClaimSeat={onClaimSeat} />,
      );
    });

    expect(container.querySelectorAll('[data-testid^="rt-seat-"]')).toHaveLength(SEAT_COUNTS.mahogany);
    expect(container.querySelector('[data-testid="rt-seat-0"] .rt-fig')).not.toBeNull();
    expect(container.querySelector('[data-testid="rt-seat-1"] .rt-fig')).toBeNull();

    await act(async () => container.querySelector('[data-testid="rt-seat-3"]').click());
    expect(onClaimSeat).toHaveBeenCalledWith(3);
  });
});
