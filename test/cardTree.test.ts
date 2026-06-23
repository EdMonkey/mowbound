import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARDS, CARD_ROOT_ID } from "../src/game/config/cards";
import {
  canSelectTool,
  isMapUnlocked,
  canUnlockCard,
  nextAffordableCardGoals,
  selectTool,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";
import { getRuntimeStats } from "../src/game/systems/CardEffectSystem";
import { defaultSave } from "../src/game/systems/SaveSystem";

const FIVE_MINUTE_LAYER_Y = 220;

const MAJOR_TIME_LAYERS = [
  { minute: 0, ids: ["root_sharpen"] },
  { minute: 5, ids: ["clean_rows_1"] },
  { minute: 10, ids: ["ember", "survey_rock"] },
  { minute: 15, ids: ["seed_bombs"] },
  { minute: 20, ids: ["golden_field", "survey_tree"] },
  { minute: 25, ids: ["open_acre"] },
  { minute: 30, ids: ["wide_sickle", "fast_sickle"] },
  { minute: 35, ids: ["alien_crop_mark"] },
  { minute: 40, ids: ["tractor_license"] },
  { minute: 45, ids: ["mower_laser"] },
  { minute: 50, ids: ["summon_codex", "summon_drone", "summon_lightning"] },
  { minute: 55, ids: ["summon_tornado", "summon_tractor"] },
];

function expectedLayerY(minute: number): number {
  return minute === 0 ? 0 : -(minute / 5) * FIVE_MINUTE_LAYER_Y;
}

describe("card tree data", () => {
  it("contains the expected card count and total cost", () => {
    expect(CARDS).toHaveLength(138);
    expect(CARDS.reduce((sum, card) => sum + card.cost, 0)).toBe(55597);
    expect(CARD_ROOT_ID).toBe("root_sharpen");
  });

  it("uses the revised expert-reviewed unlock costs", () => {
    const costs = Object.fromEntries(CARDS.map((card) => [card.id, card.cost]));
    expect(costs).toMatchObject({
      root_sharpen: 10,
      clean_rows_1: 34,
      ember: 90,
      survey_rock: 130,
      seed_bombs: 220,
      golden_field: 420,
      survey_tree: 360,
      open_acre: 420,
      wide_sickle: 600,
      fast_sickle: 600,
      alien_crop_mark: 1300,
      tractor_license: 1900,
      mower_laser: 1700,
      summon_codex: 1600,
      summon_drone: 2100,
      summon_lightning: 2200,
      summon_tornado: 3000,
      summon_tractor: 3200,
    });
  });

  it("keeps all prereq ids valid", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq], `${card.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });

  it("places major experience cards on 5-minute time layers", () => {
    for (const layer of MAJOR_TIME_LAYERS) {
      for (const id of layer.ids) {
        const card = CARD_BY_ID[id];
        expect(card, id).toBeDefined();
        expect(card.layout.y, id).toBe(expectedLayerY(layer.minute));
      }
    }
  });

  it("keeps equipment left, harvest center, environment right, and special fruit outside", () => {
    const inRange = (value: number, min: number, max: number) => value >= min && value <= max;

    for (const card of CARDS) {
      const effectKinds = card.effects.map((effect) => effect.kind);
      const isSpecialFruit =
        card.branch === "summon" ||
        card.branch === "spectacle" ||
        effectKinds.includes("bombCount10m");

      if (card.id === "root_sharpen") {
        expect(card.layout.x, card.id).toBe(0);
      } else if (isSpecialFruit) {
        expect(Math.abs(card.layout.x), card.id).toBeGreaterThanOrEqual(1050);
      } else if (card.category === "equipment") {
        expect(inRange(card.layout.x, -1000, -350), card.id).toBe(true);
      } else if (card.category === "harvest") {
        expect(inRange(card.layout.x, -180, 220), card.id).toBe(true);
      } else if (card.category === "environment") {
        expect(inRange(card.layout.x, 350, 1000), card.id).toBe(true);
      } else if (card.category === "ability") {
        expect(Math.abs(card.layout.x), card.id).toBeGreaterThanOrEqual(1050);
      }
    }
  });
});

describe("card runtime", () => {
  it("applies root and blade damage", () => {
    let save = { ...defaultSave(), gold: 999 };
    save = unlockCard(save, "root_sharpen");
    save = unlockCard(save, "sharp_edge_1");
    expect(getRuntimeStats(save).attackDamage).toBe(5);
  });

  it("uses softened seed_bombs gate", () => {
    const save = { ...defaultSave(), gold: 999, unlockedCards: { root_sharpen: 1, survey_rock: 1 } };
    expect(canUnlockCard(save, "seed_bombs")).toBe(false);
    const cleared = {
      ...save,
      lifetimeStats: { ...save.lifetimeStats, bestClearPercentByMap: { "10": 15 } },
    };
    expect(canUnlockCard(cleared, "seed_bombs")).toBe(true);
  });

  it("locks 30m until open_acre is unlocked", () => {
    const save = defaultSave();
    expect(isMapUnlocked(save, 10)).toBe(true);
    expect(isMapUnlocked(save, 30)).toBe(false);
    expect(isMapUnlocked({ ...save, unlockedCards: { open_acre: 1 } }, 30)).toBe(true);
  });

  it("requires all prereqs before unlocking multi-prereq nodes", () => {
    const partial = { ...defaultSave(), gold: 2000, unlockedCards: { clean_sweep_2: 1 } };
    expect(canUnlockCard(partial, "cyclone_cut")).toBe(false);

    const complete = {
      ...defaultSave(),
      gold: 2000,
      unlockedCards: { clean_sweep_2: 1, quick_recovery_2: 1 },
    };
    expect(canUnlockCard(complete, "cyclone_cut")).toBe(true);
  });

  it("returns next goals sorted by affordable cost", () => {
    const save = { ...defaultSave(), gold: 25, unlockedCards: { root_sharpen: 1 } };
    expect(nextAffordableCardGoals(save, 3).map((card) => card.id)).toEqual([
      "light_boots_1",
      "sharp_edge_1",
      "market_cart_1",
    ]);
  });

  it("allows selecting only unlocked tools", () => {
    const save = defaultSave();
    expect(canSelectTool(save, "wide_sickle")).toBe(false);
    expect(canSelectTool(save, "tractor")).toBe(false);
    const unlocked = { ...save, unlockedCards: { wide_sickle: 1 } };
    expect(canSelectTool(unlocked, "wide_sickle")).toBe(true);
    expect(selectTool(unlocked, "wide_sickle").selectedTool).toBe("wide_sickle");
    const tractorUnlocked = { ...save, unlockedCards: { tractor_license: 1 } };
    expect(canSelectTool(tractorUnlocked, "tractor")).toBe(true);
    expect(selectTool(tractorUnlocked, "tractor").selectedTool).toBe("tractor");
  });
});
