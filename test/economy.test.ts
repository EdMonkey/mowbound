import { describe, expect, it } from "vitest";
import {
  clearPercentScore,
  detectCleanPatchCount,
  goldFromScore,
  scoreRun,
  type EconomyStats,
} from "../src/game/systems/EconomySystem";

const baseStats: EconomyStats = {
  goldDivisor: 4,
  goldMultiplier: 1,
  grassScoreMultiplier: 1,
  cleanPatchScore: 0,
  clearBonusPercent: 0,
  rockScore: 0,
  treeScore: 0,
  bombChainScore: 0,
  firstBombScoreMultiplier: 1,
  obstacleScoreMultiplier: 1,
  largeMapBonusCap: 1,
};

describe("event economy", () => {
  it("converts grass score to gold", () => {
    const result = scoreRun([{ kind: "grassCut", count: 40 }], baseStats);
    expect(result.totalScore).toBe(40);
    expect(goldFromScore(result.totalScore, baseStats)).toBe(10);
  });

  it("uses 5/10/20/35/50 clear milestones", () => {
    expect(clearPercentScore(4, 0)).toBe(0);
    expect(clearPercentScore(5, 0)).toBe(10);
    expect(clearPercentScore(10, 0)).toBe(35);
    expect(clearPercentScore(50, 0)).toBe(465);
  });

  it("detects clean patches as 40 grass within 3 seconds", () => {
    const cuts = Array.from({ length: 40 }, (_, index) => index * 50);
    expect(detectCleanPatchCount(cuts, 3000, 40)).toBe(1);
  });
});
