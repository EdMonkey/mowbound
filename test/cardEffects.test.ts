import { describe, expect, it } from "vitest";
import {
  getEconomyStats,
  getRuntimeStats,
} from "../src/game/systems/CardEffectSystem";
import { BALANCE } from "../src/game/config/balance";
import { goldFromScore } from "../src/game/systems/EconomySystem";
import { defaultSave, normalizeSave } from "../src/game/systems/SaveSystem";

function saveWithCards(unlockedCards: Record<string, number>, selectedTool = "default") {
  return normalizeSave({
    ...defaultSave(),
    unlockedCards,
    selectedTool,
  });
}

describe("card effect runtime folding", () => {
  it("uses a faster opening gold conversion before economy cards", () => {
    const stats = getEconomyStats(defaultSave());

    expect(stats.goldDivisor).toBe(2);
    expect(goldFromScore(14, stats)).toBe(7);
    expect(goldFromScore(28, stats)).toBe(14);
  });

  it("folds attack damage and range from unlocked cards", () => {
    const stats = getRuntimeStats(saveWithCards({ root_sharpen: 1, clean_sweep_1: 1 }));

    expect(stats.attackDamage).toBe(4);
    expect(stats.attackRangeMeters).toBeCloseTo(0.6);
  });

  it("folds economy effects from unlocked cards", () => {
    const stats = getEconomyStats(saveWithCards({ market_cart_1: 1, clean_rows_1: 1 }));

    expect(stats.goldDivisor).toBeCloseTo(1.7);
    expect(stats.cleanPatchScore).toBe(8);
  });

  it("applies selected tool modifiers only when tool unlock card is owned", () => {
    const lockedWide = getRuntimeStats(saveWithCards({}, "wide_sickle"));
    const unlockedWide = getRuntimeStats(saveWithCards({ wide_sickle: 1 }, "wide_sickle"));
    const lockedBombEconomy = getEconomyStats(saveWithCards({ chain_payout_1: 1 }, "bomb_sickle"));
    const unlockedBombEconomy = getEconomyStats(saveWithCards(
      { bomb_sickle: 1, chain_payout_1: 1 },
      "bomb_sickle",
    ));

    expect(lockedWide.selectedTool).toBe("default");
    expect(lockedWide.attackRangeMeters).toBeCloseTo(0.5);
    expect(unlockedWide.selectedTool).toBe("wide_sickle");
    expect(unlockedWide.attackRangeMeters).toBeCloseTo(0.75);
    expect(unlockedWide.attackIntervalMs).toBe(1150);
    expect(lockedBombEconomy.bombChainScore).toBe(30);
    expect(unlockedBombEconomy.bombChainScore).toBe(36);
  });

  it("folds special flags and summon runtime", () => {
    const stats = getRuntimeStats(saveWithCards({ cyclone_cut: 1, summon_shadow: 1 }));

    expect(stats.hasCycloneCut).toBe(true);
    expect(stats.summons.shadowClone.count).toBe(1);
    expect(stats.summons.shadowClone.damageFactor).toBeCloseTo(0.5);
  });

  it("gates special grass spawns behind their cards", () => {
    const base = getRuntimeStats(saveWithCards({}));
    const unlocked = getRuntimeStats(saveWithCards({ bluefoot: 1, timerboon: 1, tallbounty: 1 }));

    expect(base.blueGrassRate).toBe(0);
    expect(base.tallGrassRate).toBe(0);
    expect(base.timerGrassCount).toBe(0);
    expect(unlocked.blueGrassRate).toBeCloseTo(BALANCE.blueGrassSpawnRate);
    expect(unlocked.tallGrassRate).toBeCloseTo(BALANCE.tallGrassSpawnRate);
    expect(unlocked.timerGrassCount).toBe(BALANCE.timerGrassCount);
  });
});
