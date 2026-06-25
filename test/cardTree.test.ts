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

describe("card tree data", () => {
  it("contains the expected card count and total cost", () => {
    expect(CARDS).toHaveLength(142);
    expect(CARDS.reduce((sum, card) => sum + card.cost, 0)).toBe(46440);
    expect(CARD_ROOT_ID).toBe("root_sharpen");
  });

  it("uses the revised expert-reviewed unlock costs", () => {
    const costs = Object.fromEntries(CARDS.map((card) => [card.id, card.cost]));
    expect(costs).toMatchObject({
      root_sharpen: 10,
      sharp_edge_1: 18,
      sharp_edge_2: 60,
      clean_sweep_1: 28,
      clean_sweep_2: 90,
      quick_recovery_1: 35,
      quick_recovery_2: 130,
      heavy_edge: 110,
      cyclone_cut: 1200,
      light_boots_1: 14,
      light_boots_2: 55,
      field_rhythm_1: 32,
      field_rhythm_2: 125,
      sprint_harvest: 260,
      long_day: 700,
      market_cart_1: 20,
      market_cart_2: 80,
      clean_rows_1: 26,
      clean_rows_2: 110,
      bulk_buyer_1: 75,
      bulk_buyer_2: 210,
      golden_field: 380,
      accountant: 1200,
      stone_chips: 70,
      wood_haul: 95,
      stump_grinder: 160,
      recoil_training: 120,
      quarry_blade: 240,
      clearcut: 360,
      lumberjack: 1400,
      seed_bombs: 160,
      fuse_training_1: 190,
      blast_control_1: 220,
      chain_payout_1: 260,
      fuse_training_2: 780,
      blast_control_2: 850,
      harvest_detonation: 1800,
      open_acre: 600,
      dense_growth: 220,
      fertile_soil: 300,
      wide_sickle: 1200,
      fast_sickle: 1200,
      bomb_sickle: 1500,
      alien_crop_mark: 1200,
      mower_laser: 1500,
      tractor_license: 2200,
    });
  });

  it("keeps all prereq ids valid", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq], `${card.id} prereq ${prereq}`).toBeDefined();
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
    // seed_bombs is revealed only after its staged prereq chain; unlock it so
    // this test exercises the gate, not prereq reachability.
    const save = {
      ...defaultSave(),
      gold: 999,
      unlockedCards: { root_sharpen: 1, sharp_edge_1: 1, sharp_edge_2: 1 },
    };
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
    // root reveals one entry per category; all three are affordable at 25g.
    expect(nextAffordableCardGoals(save, 3).map((card) => card.id)).toEqual([
      "sharp_edge_1",
      "market_cart_1",
      "grasslore",
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
