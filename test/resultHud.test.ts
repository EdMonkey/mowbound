import { describe, expect, it } from "vitest";
import { getResultBreakdownRows } from "../src/game/ui/Hud";
import type { RunSummary } from "../src/game/systems/RunSummarySystem";

const summary: RunSummary = {
  gold: 37,
  grassCut: 80,
  rocksBroken: 1,
  treesCut: 0,
  bombsTriggered: 0,
  bestBombChain: 0,
  mapSize: 10,
  clearPercent: 10,
  score: {
    totalScore: 75,
    breakdown: {
      grass: 40,
      cleanRows: 0,
      obstacles: 20,
      bombChains: 0,
      clearBonus: 15,
    },
  },
};

describe("result HUD breakdown", () => {
  it("uses earned gold as the emphasized final result value", () => {
    const rows = getResultBreakdownRows(summary, "ko");

    expect(rows.at(-1)).toEqual({ label: "획득 골드", value: 37, emphasized: true, suffix: "g" });
    expect(rows.map((row) => row.label)).not.toContain("총점");
  });

  it("uses earned gold wording in English too", () => {
    const rows = getResultBreakdownRows(summary, "en");

    expect(rows.at(-1)).toEqual({ label: "Earned Gold", value: 37, emphasized: true, suffix: "g" });
    expect(rows.map((row) => row.label)).not.toContain("Total Score");
  });
});
