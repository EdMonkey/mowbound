import { describe, expect, it } from "vitest";
import {
  CARD_BY_ID,
  CARD_CATEGORIES,
  CARDS,
  compareCardsForCatalog,
  filterCards,
  groupCardsByCategoryAndTier,
} from "../src/game/config/cards";

describe("card catalog data", () => {
  it("loads the whole upgrade set as cards with stable categories and tiers", () => {
    expect(CARDS).toHaveLength(138);
    expect(CARD_CATEGORIES).toEqual(["equipment", "harvest", "environment", "ability"]);

    expect(CARD_BY_ID.root_sharpen.category).toBe("equipment");
    expect(CARD_BY_ID.root_sharpen.tier).toBe(0);
    expect(CARD_BY_ID.sharp_edge_2.tier).toBe(2);
    expect(CARD_BY_ID.cyclone_cut.tier).toBe(3);

    expect(CARD_BY_ID.market_cart_1.category).toBe("harvest");
    expect(CARD_BY_ID.open_acre.category).toBe("environment");
    expect(CARD_BY_ID.seed_bombs.category).toBe("ability");
    expect(CARD_BY_ID.summon_drone.category).toBe("ability");
  });

  it("keeps Korean-facing card names and descriptions in the JSON", () => {
    expect(CARD_BY_ID.root_sharpen.nameKo).toBe("첫 날 갈기");
    expect(CARD_BY_ID.seed_bombs.nameKo).toBe("씨앗 폭탄");
    expect(CARD_BY_ID.mower_laser.nameKo).toBe("잔디깎이 레이저");
    expect(CARD_BY_ID.mower_laser.descriptionKo).toContain("레이저");
  });

  it("keeps card prereq ids valid for future tree rendering", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq], `${card.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });
});

describe("card catalog filters", () => {
  it("filters by category, tier, effect kind, and search text", () => {
    expect(filterCards({ category: "ability" }).map((card) => card.id)).toContain("seed_bombs");
    expect(filterCards({ category: "harvest" }).map((card) => card.id)).toContain("market_cart_1");
    expect(filterCards({ tier: 1 }).map((card) => card.id)).toContain("clean_sweep_1");
    expect(filterCards({ effectKind: "summon" }).map((card) => card.id)).toContain("summon_drone");
    expect(filterCards({ search: "laser" }).map((card) => card.id)).toEqual(["mower_laser"]);
  });

  it("groups cards by category and tier for table/tree inspection", () => {
    const grouped = groupCardsByCategoryAndTier(CARDS);
    expect(grouped.equipment[0].map((card) => card.id)).toEqual(["root_sharpen"]);
    expect(grouped.harvest[1].map((card) => card.id)).toContain("market_cart_1");
    expect(grouped.ability[1].map((card) => card.id)).toContain("seed_bombs");
    expect(grouped.environment[1].map((card) => card.id)).toContain("survey_rock");
  });

  it("sorts cards in the intended catalog category order", () => {
    const sorted = [...CARDS].sort(compareCardsForCatalog);
    expect(sorted[0].id).toBe("root_sharpen");
    expect(sorted.findIndex((card) => card.id === "market_cart_1")).toBeLessThan(
      sorted.findIndex((card) => card.id === "survey_rock"),
    );
    expect(sorted.findIndex((card) => card.id === "survey_rock")).toBeLessThan(
      sorted.findIndex((card) => card.id === "seed_bombs"),
    );
  });
});
