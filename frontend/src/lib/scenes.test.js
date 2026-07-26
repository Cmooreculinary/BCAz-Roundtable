import {
  AUDIENCE_ACTIONS,
  DEFAULT_SCENE,
  SEAT_COUNTS,
  STAGE_VENUES,
  VENUES,
  isStageVenue,
  resolveScene,
  seatPositions,
  stageLayoutFor,
  tableGeometryFor,
} from "./scenes";

describe("venue catalog", () => {
  test("stage venues are selectable and marked as stages", () => {
    expect(STAGE_VENUES.map((v) => v.id)).toEqual(["theatre", "redrocks", "arena"]);
    STAGE_VENUES.forEach((venue) => {
      expect(isStageVenue(venue.id)).toBe(true);
      expect(VENUES).toContain(venue);
      // Stage art is generated, so it must resolve without a network asset.
      expect(venue.image.startsWith("data:image/svg+xml")).toBe(true);
      expect(stageLayoutFor(venue.id).rows.length).toBeGreaterThan(2);
    });
  });

  test("table rooms are not stages and the default scene still resolves", () => {
    expect(isStageVenue("library")).toBe(false);
    expect(isStageVenue(undefined)).toBe(false);
    expect(resolveScene(DEFAULT_SCENE).room.id).toBe("library");
    expect(resolveScene({ ...DEFAULT_SCENE, room: "theatre" }).room.kind).toBe("stage");
  });

  test("audience actions cover clap, stand, fist, and folded arms", () => {
    expect(AUDIENCE_ACTIONS.map((a) => a.id).sort()).toEqual(
      ["arms_folded", "clap", "fist_raised", "stand"],
    );
  });
});

describe("seat geometry", () => {
  test("every table seats exactly its declared number of guests", () => {
    Object.entries(SEAT_COUNTS).forEach(([tableId, count]) => {
      expect(seatPositions(tableId, count)).toHaveLength(count);
    });
  });

  test("round tables place chairs clear of the tabletop on every side", () => {
    const geo = tableGeometryFor("mahogany");
    seatPositions("mahogany", SEAT_COUNTS.mahogany).forEach(({ x, y }) => {
      // A chair must sit outside the table's own footprint, not on top of it.
      const outside = Math.abs(x) > geo.width / 2 || Math.abs(y) > (geo.depth / 2) * 0.62;
      expect(outside).toBe(true);
    });
  });

  test("long tables seat guests down the edges, not on a circle", () => {
    const seats = seatPositions("executive", SEAT_COUNTS.executive);
    const geo = tableGeometryFor("executive");
    const far = seats.filter((s) => s.y < 0);
    const near = seats.filter((s) => s.y > 0);
    const ends = seats.filter((s) => s.y === 0);

    expect(ends).toHaveLength(2);
    expect(far.length + near.length + ends.length).toBe(SEAT_COUNTS.executive);
    // Edge seats share one row each — that is what makes it read as a long table.
    expect(new Set(far.map((s) => s.y)).size).toBe(1);
    expect(new Set(near.map((s) => s.y)).size).toBe(1);
    ends.forEach((seat) => expect(Math.abs(seat.x)).toBeGreaterThan(geo.width / 2));
  });

  test("depth runs from the far side of the table to the camera", () => {
    const seats = seatPositions("strategy", SEAT_COUNTS.strategy);
    seats.forEach((seat) => {
      expect(seat.depth).toBeGreaterThanOrEqual(0);
      expect(seat.depth).toBeLessThanOrEqual(1);
      // Depth and screen position must agree, or figures stack in the wrong order.
      expect(seat.depth > 0.5).toBe(seat.y > 0);
    });
  });
});
