import {
  PORTRAIT_PREFIX,
  PORTRAIT_SEEDS,
  avatarSrc,
  isPortraitRef,
  portraitDataUri,
  portraitRef,
  portraitTraits,
  seedForUser,
  seedFromRef,
} from "./avatars";

describe("roundtable portraits", () => {
  test("the same seed always produces the same face", () => {
    expect(portraitTraits("Harrison")).toEqual(portraitTraits("Harrison"));
    expect(portraitDataUri("Harrison")).toBe(portraitDataUri("Harrison"));
  });

  test("the cast is varied rather than a row of clones", () => {
    const signatures = new Set(
      PORTRAIT_SEEDS.map((seed) => {
        const t = portraitTraits(seed);
        return [t.skin.base, t.hair, t.hairStyle, t.suit.main].join("|");
      }),
    );
    expect(signatures.size).toBeGreaterThan(PORTRAIT_SEEDS.length / 2);
  });

  test("portraits render as self-contained SVG, never a remote request", () => {
    const uri = portraitDataUri("Naomi");
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(uri)).toContain("<svg");
    // The only http in a portrait is the SVG namespace — nothing is fetched.
    const decoded = decodeURIComponent(uri);
    expect(decoded).not.toMatch(/(href|src)=/);
    expect(decoded).not.toContain("url(http");
  });

  test("a stored portrait is a compact reference, resolved at render time", () => {
    const ref = portraitRef("Simone");
    expect(ref).toBe(`${PORTRAIT_PREFIX}Simone`);
    expect(ref.length).toBeLessThan(40);
    expect(isPortraitRef(ref)).toBe(true);
    expect(seedFromRef(ref)).toBe("Simone");
    expect(avatarSrc(ref)).toBe(portraitDataUri("Simone"));
  });

  test("existing image avatars keep working untouched", () => {
    const legacy = "https://api.dicebear.com/9.x/personas/svg?seed=Luna";
    expect(isPortraitRef(legacy)).toBe(false);
    expect(seedFromRef(legacy)).toBeNull();
    expect(avatarSrc(legacy)).toBe(legacy);
    expect(avatarSrc(null)).toBeNull();
  });

  test("a member without a chosen portrait still gets a stable face", () => {
    const member = { id: "user-42", name: "Ada" };
    expect(seedForUser(member)).toBe("user-42");
    expect(seedForUser({ ...member, avatar_url: portraitRef("Theo") })).toBe("Theo");
    expect(seedForUser({})).toBe("guest");
  });
});
