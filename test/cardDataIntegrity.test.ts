import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARD_EFFECT_KINDS, CARD_ROOT_ID, CARDS } from "../src/game/config/cards";

describe("card data integrity", () => {
  it("keeps root card id mapped to root card", () => {
    expect(CARD_BY_ID[CARD_ROOT_ID]?.id).toBe(CARD_ROOT_ID);
  });

  it("keeps card ids unique", () => {
    const cardIds = CARDS.map((card) => card.id);

    expect(new Set(cardIds).size).toBe(cardIds.length);
  });

  it("keeps every prereq id resolvable", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq], `${card.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });

  it("keeps every card layout finite", () => {
    for (const card of CARDS) {
      expect(Number.isFinite(card.layout.x), `${card.id} layout.x`).toBe(true);
      expect(Number.isFinite(card.layout.y), `${card.id} layout.y`).toBe(true);
    }
  });

  it("keeps every card cost non-negative", () => {
    for (const card of CARDS) {
      expect(card.cost, `${card.id} cost`).toBeGreaterThanOrEqual(0);
    }
  });

  it("exposes required card effect kinds", () => {
    expect(CARD_EFFECT_KINDS).toEqual(expect.arrayContaining(["attackDamage", "toolUnlock", "summon"]));
  });
});
