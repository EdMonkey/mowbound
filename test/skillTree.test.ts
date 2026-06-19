import { describe, expect, it } from "vitest";
import { SKILL_NODE_BY_ID, SKILL_NODES, SKILL_ROOT } from "../src/game/config/skillTree";
import { canUnlockNode, getRuntimeStats, isMapUnlocked, unlockNode } from "../src/game/systems/SkillSystem";
import { defaultSave } from "../src/game/systems/SaveSystem";

describe("v2 skill tree data", () => {
  it("contains 46 nodes and revised total cost", () => {
    expect(SKILL_NODES).toHaveLength(46);
    expect(SKILL_NODES.reduce((sum, node) => sum + node.cost, 0)).toBe(21593);
    expect(SKILL_ROOT).toBe("root_sharpen");
  });

  it("uses the revised expert-reviewed unlock costs", () => {
    const costs = Object.fromEntries(SKILL_NODES.map((node) => [node.id, node.cost]));
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
    for (const node of SKILL_NODES) {
      for (const prereq of node.prereq) {
        expect(SKILL_NODE_BY_ID[prereq], `${node.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });
});

describe("v2 skill runtime", () => {
  it("applies root and blade damage", () => {
    let save = { ...defaultSave(), gold: 999 };
    save = unlockNode(save, "root_sharpen");
    save = unlockNode(save, "sharp_edge_1");
    expect(getRuntimeStats(save).attackDamage).toBe(5);
  });

  it("uses softened seed_bombs gate", () => {
    const save = { ...defaultSave(), gold: 999, levels: { root_sharpen: 1 } };
    expect(canUnlockNode(save, "seed_bombs")).toBe(false);
    const cleared = {
      ...save,
      lifetimeStats: { ...save.lifetimeStats, bestClearPercentByMap: { "10": 15 } },
    };
    expect(canUnlockNode(cleared, "seed_bombs")).toBe(true);
  });

  it("locks 30m until open_acre is unlocked", () => {
    const save = defaultSave();
    expect(isMapUnlocked(save, 10)).toBe(true);
    expect(isMapUnlocked(save, 30)).toBe(false);
    expect(isMapUnlocked({ ...save, levels: { open_acre: 1 } }, 30)).toBe(true);
  });
});
