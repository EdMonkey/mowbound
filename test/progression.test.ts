import { describe, expect, it } from "vitest";
import { CARDS } from "../src/game/config/cards";
import { defaultSave, type SaveData } from "../src/game/systems/SaveSystem";
import {
  canUnlockCard,
  isCardUnlocked,
  isCardRevealed,
  nextAffordableCardGoals,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";

const demoGoldByRun = [
  12, 11, 13, 16, 19,
  23, 28, 33, 40, 48,
  58, 69, 83, 99, 118,
  138, 160, 185, 215, 250,
  290, 330, 370, 410, 450,
  490, 530, 570, 610, 650,
];

const demoClearPercentByRun = [
  6, 8, 10, 12, 14,
  15, 16, 18, 20, 22,
  24, 26, 28, 30, 31,
  32, 33, 34, 35, 36,
  37, 38, 39, 40, 41,
  42, 43, 44, 45, 46,
];

const demoGrassCutByRun = [
  80, 95, 110, 125, 140,
  160, 180, 205, 230, 255,
  285, 315, 345, 380, 415,
  450, 490, 530, 570, 610,
  660, 710, 760, 815, 870,
  930, 990, 1050, 1120, 1200,
];

const spectacleIds = ["alien_crop_mark", "mower_laser", "tractor_license"] as const;

function applyDemoMilestones(save: SaveData, runIndex: number): SaveData {
  const currentClear = save.lifetimeStats.bestClearPercentByMap["10"] ?? 0;
  return {
    ...save,
    lifetimeStats: {
      ...save.lifetimeStats,
      grassCut: save.lifetimeStats.grassCut + demoGrassCutByRun[runIndex],
      bestBombChain: Math.max(save.lifetimeStats.bestBombChain, runIndex >= 12 ? 2 : 0),
      bestClearPercentByMap: {
        ...save.lifetimeStats.bestClearPercentByMap,
        "10": Math.max(currentClear, demoClearPercentByRun[runIndex]),
      },
    },
  };
}

function chooseNextPurchase(save: SaveData) {
  const firstSpectacle = spectacleIds.find((id) => !isCardUnlocked(save, id) && canUnlockCard(save, id));
  if (firstSpectacle) {
    return CARDS.find((card) => card.id === firstSpectacle);
  }
  if (!isCardUnlocked(save, "alien_crop_mark") && isCardRevealed(save, "alien_crop_mark")) {
    return undefined;
  }
  return nextAffordableCardGoals(save, 1)[0];
}

function buyEverythingAvailable(save: SaveData): SaveData {
  let current = save;
  let bought = true;
  while (bought) {
    bought = false;
    const next = chooseNextPurchase(current);
    if (next && canUnlockCard(current, next.id)) {
      current = unlockCard(current, next.id);
      bought = true;
    }
  }
  return current;
}

function simulateOneHour(): SaveData {
  let save = defaultSave();
  for (let runIndex = 0; runIndex < demoGoldByRun.length; runIndex += 1) {
    save = applyDemoMilestones({ ...save, gold: save.gold + demoGoldByRun[runIndex] }, runIndex);
    save = buyEverythingAvailable(save);
  }
  return save;
}

describe("one hour demo progression", () => {
  it("allows early purchases in the first two runs", () => {
    const save = { ...defaultSave(), gold: demoGoldByRun[0] };
    expect(nextAffordableCardGoals(save, 3).map((card) => card.id)).toContain("root_sharpen");
  });

  it("does not complete the whole tree within the 60 minute target curve", () => {
    const save = simulateOneHour();
    const unlockedCount = Object.keys(save.unlockedCards).length;
    expect(unlockedCount).toBeGreaterThanOrEqual(26);
    expect(unlockedCount).toBeLessThanOrEqual(34);
    expect(unlockedCount).toBeLessThan(CARDS.length);
  });

  it("allows one spectacle skill after its midgame prerequisites", () => {
    const save = {
      ...defaultSave(),
      gold: 1200,
      unlockedCards: {
        root_sharpen: 1,
        clean_sweep_1: 1,
        clean_sweep_2: 1,
        seed_bombs: 1,
        chain_payout_1: 1,
      },
    };
    expect(canUnlockCard(save, "alien_crop_mark")).toBe(true);
  });

  it("makes at least one spectacle skill part of the one hour route", () => {
    const save = simulateOneHour();
    expect(spectacleIds.some((id) => isCardUnlocked(save, id))).toBe(true);
  });
});
