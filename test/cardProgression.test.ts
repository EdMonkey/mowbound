import { describe, expect, it } from "vitest";
import { CARD_BY_ID } from "../src/game/config/cards";
import {
  canSelectTool,
  canUnlockCard,
  areCardGatesSatisfied,
  getCardCost,
  getRevealedCards,
  isCardRevealed,
  isCardUnlocked,
  isMapUnlocked,
  nextAffordableCardGoals,
  selectTool,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";
import { defaultSave, normalizeSave } from "../src/game/systems/SaveSystem";

describe("card progression", () => {
  it("reveals root and allows unlocking root when a new save has enough gold", () => {
    const save = { ...defaultSave(), gold: 10 };

    expect(isCardRevealed(save, "root_sharpen")).toBe(true);
    expect(canUnlockCard(save, "root_sharpen")).toBe(true);
  });

  it("unlocks root, spends gold, and mirrors legacy levels", () => {
    const save = unlockCard({ ...defaultSave(), gold: 10 }, "root_sharpen");

    expect(save.gold).toBe(0);
    expect(isCardUnlocked(save, "root_sharpen")).toBe(true);
    expect(save.unlockedCards.root_sharpen).toBe(1);
    expect(save.levels.root_sharpen).toBe(1);
  });

  it("reveals child cards after root unlocks", () => {
    const before = { ...defaultSave(), gold: 10 };
    const after = unlockCard(before, "root_sharpen");

    expect(isCardRevealed(before, "sharp_edge_1")).toBe(false);
    expect(isCardRevealed(after, "sharp_edge_1")).toBe(true);
  });

  it("returns Infinity for missing card cost", () => {
    expect(getCardCost("missing")).toBe(Number.POSITIVE_INFINITY);
  });

  it("reveals multi-prereq card when any prereq is unlocked but cannot unlock until all prereqs are unlocked", () => {
    const partial = normalizeSave({
      ...defaultSave(),
      gold: 9999,
      unlockedCards: { clean_sweep_2: 1 },
      levels: {},
    });

    const complete = normalizeSave({
      ...partial,
      unlockedCards: { clean_sweep_2: 1, quick_recovery_2: 1 },
    });

    expect(CARD_BY_ID.cyclone_cut.prereq).toEqual(["clean_sweep_2", "quick_recovery_2"]);
    expect(isCardRevealed(partial, "cyclone_cut")).toBe(true);
    expect(canUnlockCard(partial, "cyclone_cut")).toBe(false);
    expect(canUnlockCard(complete, "cyclone_cut")).toBe(true);
  });

  it("enforces map and tool unlock effects", () => {
    const base = defaultSave();
    const unlocked = normalizeSave({
      ...base,
      unlockedCards: {
        open_acre: 1,
        tractor_license: 1,
      },
    });

    expect(isMapUnlocked(base, 10)).toBe(true);
    expect(canSelectTool(base, "default")).toBe(true);
    expect(isMapUnlocked(base, 30)).toBe(false);
    expect(canSelectTool(base, "tractor")).toBe(false);
    expect(isMapUnlocked(unlocked, 30)).toBe(true);
    expect(canSelectTool(unlocked, "tractor")).toBe(true);
  });

  it("satisfies multi-gates when any one gate passes", () => {
    const save = normalizeSave({
      ...defaultSave(),
      lifetimeStats: {
        ...defaultSave().lifetimeStats,
        grassCut: 500,
      },
    });

    expect(areCardGatesSatisfied(defaultSave(), CARD_BY_ID.seed_bombs)).toBe(false);
    expect(areCardGatesSatisfied(save, CARD_BY_ID.seed_bombs)).toBe(true);
  });

  it("returns revealed cards and next affordable goals in cost order", () => {
    const save = normalizeSave({
      ...defaultSave(),
      gold: 35,
      unlockedCards: { root_sharpen: 1 },
    });

    expect(getRevealedCards(defaultSave()).map((card) => card.id)).toContain("root_sharpen");
    expect(nextAffordableCardGoals(save).map((card) => card.id)).toEqual([
      "light_boots_1",
      "sharp_edge_1",
      "market_cart_1",
    ]);
  });

  it("selects unlocked tools and ignores locked tools", () => {
    const base = defaultSave();
    const unlocked = normalizeSave({
      ...base,
      unlockedCards: { tractor_license: 1 },
    });

    expect(selectTool(base, "tractor").selectedTool).toBe("default");
    expect(selectTool(unlocked, "tractor").selectedTool).toBe("tractor");
  });
});
