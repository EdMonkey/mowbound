import { describe, expect, it } from "vitest";
import { visibleTotalGold } from "../src/game/systems/RunGoldDisplaySystem";

describe("run gold display", () => {
  it("adds pending run gold before banking the run", () => {
    expect(visibleTotalGold({ savedGold: 25, roundGold: 12, roundBanked: false })).toBe(37);
  });

  it("does not add run gold again after the run has been banked", () => {
    expect(visibleTotalGold({ savedGold: 37, roundGold: 12, roundBanked: true })).toBe(37);
  });
});
