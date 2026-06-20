import { describe, expect, it } from "vitest";
import { SKILL_NODES } from "../src/game/config/skillTree";
import {
  applyRunResultToSave,
  defaultSave,
  normalizeSave,
  unlockAllSkillsForTest,
} from "../src/game/systems/SaveSystem";

describe("save v2", () => {
  it("creates v2 save with lifetime stats", () => {
    expect(defaultSave()).toEqual({
      schemaVersion: 2,
      gold: 0,
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
    expect(save.levels.root_sharpen).toBe(1);
    expect(save.levels.sharp_edge_1).toBe(1);
    expect(save.levels.market_cart_1).toBe(1);
    expect(save.levels.unknown).toBeUndefined();
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

  it("unlocks every skill for test saves without changing gold or stats", () => {
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
    const unlocked = unlockAllSkillsForTest(save);

    expect(Object.keys(unlocked.levels).sort()).toEqual(SKILL_NODES.map((node) => node.id).sort());
    expect(SKILL_NODES.every((node) => unlocked.levels[node.id] === 1)).toBe(true);
    expect(unlocked.gold).toBe(save.gold);
    expect(unlocked.lifetimeStats).toEqual(save.lifetimeStats);
  });
});
