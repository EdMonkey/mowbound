import { describe, expect, it } from "vitest";
import { CARDS } from "../src/game/config/cards";
import {
  applyRunResultToSave,
  defaultSave,
  normalizeSave,
  unlockAllCardsForTest,
  unlockAllSkillsForTest,
} from "../src/game/systems/SaveSystem";

describe("save v3", () => {
  it("creates v3 save with empty card unlocks and lifetime stats", () => {
    expect(defaultSave()).toEqual({
      schemaVersion: 3,
      gold: 0,
      unlockedCards: {},
      levels: {},
      selectedTool: "default",
      lifetimeStats: {
        grassCut: 0,
        rocksBroken: 0,
        treesCut: 0,
        bombsTriggered: 0,
        bestBombChain: 0,
        bestClearPercentByMap: {},
      },
    });
  });

  it("migrates v1 totalGold and known unlocks", () => {
    const save = normalizeSave({ totalGold: 99, unlocked: ["dmg1", "dmg2", "gold1", "unknown"] });
    expect(save.gold).toBe(99);
    expect(save.unlockedCards.root_sharpen).toBe(1);
    expect(save.unlockedCards.sharp_edge_1).toBe(1);
    expect(save.unlockedCards.market_cart_1).toBe(1);
    expect(save.unlockedCards.unknown).toBeUndefined();
    expect(save.levels.root_sharpen).toBe(1);
    expect(save.levels.sharp_edge_1).toBe(1);
    expect(save.levels.market_cart_1).toBe(1);
    expect(save.levels.unknown).toBeUndefined();
  });

  it("migrates v2 levels to card unlocks and ignores unknown ids", () => {
    const save = normalizeSave({
      schemaVersion: 2,
      gold: 7,
      levels: {
        root_sharpen: 1,
        missing_node: 1,
      },
      selectedTool: "default",
      lifetimeStats: {},
    });

    expect(save.schemaVersion).toBe(3);
    expect(save.unlockedCards).toEqual({ root_sharpen: 1 });
    expect(save.levels).toEqual({ root_sharpen: 1 });
  });

  it("mirrors unlockedCards and levels during normalization", () => {
    expect(normalizeSave({
      schemaVersion: 3,
      gold: 0,
      unlockedCards: { root_sharpen: 1 },
      levels: {},
      selectedTool: "default",
      lifetimeStats: {},
    }).levels).toEqual({ root_sharpen: 1 });

    expect(normalizeSave({
      schemaVersion: 3,
      gold: 0,
      levels: { root_sharpen: 1 },
      selectedTool: "default",
      lifetimeStats: {},
    }).unlockedCards).toEqual({ root_sharpen: 1 });
  });

  it("updates lifetime stats from run result", () => {
    const save = applyRunResultToSave(defaultSave(), {
      gold: 12,
      grassCut: 100,
      rocksBroken: 2,
      treesCut: 1,
      bombsTriggered: 3,
      bestBombChain: 3,
      mapSize: 10,
      clearPercent: 18,
    });

    expect(save.gold).toBe(12);
    expect(save.lifetimeStats.grassCut).toBe(100);
    expect(save.lifetimeStats.rocksBroken).toBe(2);
    expect(save.lifetimeStats.treesCut).toBe(1);
    expect(save.lifetimeStats.bombsTriggered).toBe(3);
    expect(save.lifetimeStats.bestBombChain).toBe(3);
    expect(save.lifetimeStats.bestClearPercentByMap["10"]).toBe(18);
  });

  it("unlocks every card for test saves without changing gold or stats", () => {
    const save = applyRunResultToSave({ ...defaultSave(), gold: 37 }, {
      gold: 12,
      grassCut: 100,
      rocksBroken: 2,
      treesCut: 1,
      bombsTriggered: 3,
      bestBombChain: 3,
      mapSize: 10,
      clearPercent: 18,
    });
    const unlocked = unlockAllCardsForTest(save);

    expect(Object.keys(unlocked.unlockedCards).sort()).toEqual(CARDS.map((card) => card.id).sort());
    expect(CARDS.every((card) => unlocked.unlockedCards[card.id] === 1)).toBe(true);
    expect(unlocked.levels).toEqual(unlocked.unlockedCards);
    expect(unlocked.gold).toBe(save.gold);
    expect(unlocked.lifetimeStats).toEqual(save.lifetimeStats);
  });

  it("keeps deprecated unlockAllSkillsForTest alias for current imports", () => {
    expect(Object.keys(unlockAllSkillsForTest(defaultSave()).unlockedCards)).toHaveLength(CARDS.length);
  });
});
