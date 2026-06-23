import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARD_ROOT_ID, CARDS } from "../src/game/config/cards";
import {
  canUnlockCard,
  getRevealedCards,
  isCardUnlocked,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";
import { getUpgradeTreeEdgeClass, shouldDrawUpgradeTreeEdge } from "../src/game/scenes/UpgradeTreeScene";
import { defaultSave } from "../src/game/systems/SaveSystem";

describe("upgrade tree card data", () => {
  it("starts with the configured root card revealed", () => {
    const revealed = getRevealedCards(defaultSave()).map((card) => card.id);

    expect(CARD_ROOT_ID).toBe("root_sharpen");
    expect(revealed).toContain(CARD_ROOT_ID);
  });

  it("has finite layout coordinates for every card", () => {
    for (const card of CARDS) {
      expect(Number.isFinite(card.layout.x), card.id).toBe(true);
      expect(Number.isFinite(card.layout.y), card.id).toBe(true);
    }
  });

  it("keeps upgrade cards far enough apart to avoid visual overlap", () => {
    const minXGap = 135;
    const minYGap = 95;

    for (let i = 0; i < CARDS.length; i += 1) {
      for (let j = i + 1; j < CARDS.length; j += 1) {
        const a = CARDS[i];
        const b = CARDS[j];
        const dx = Math.abs(a.layout.x - b.layout.x);
        const dy = Math.abs(a.layout.y - b.layout.y);
        expect(dx >= minXGap || dy >= minYGap, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it("keeps every card reachable from the root through prerequisites", () => {
    const extraRoots = CARDS.filter((card) => card.id !== CARD_ROOT_ID && card.prereq.length === 0).map(
      (card) => card.id,
    );
    expect(extraRoots).toEqual([]);

    const reachable = new Set<string>([CARD_ROOT_ID]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const card of CARDS) {
        if (reachable.has(card.id)) {
          continue;
        }
        if (card.prereq.every((id) => reachable.has(id))) {
          reachable.add(card.id);
          changed = true;
        }
      }
    }

    expect([...CARDS.map((card) => card.id).filter((id) => !reachable.has(id))]).toEqual([]);
  });

  it("keeps child cards on or above their prerequisite tiers and layers", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        const parent = CARD_BY_ID[prereq];
        expect(card.tier, `${card.id} tier before ${prereq}`).toBeGreaterThanOrEqual(parent.tier);
        expect(card.layout.y, `${card.id} y below ${prereq}`).toBeLessThanOrEqual(parent.layout.y);
      }
    }
  });

  it("reveals at least one child after unlocking the root", () => {
    const root = CARD_BY_ID[CARD_ROOT_ID];
    const save = unlockCard({ ...defaultSave(), gold: root.cost }, CARD_ROOT_ID);
    const revealedChildren = getRevealedCards(save).filter((card) => card.prereq.includes(CARD_ROOT_ID));

    expect(revealedChildren.length).toBeGreaterThan(0);
  });

  it("spends gold and marks the root unlocked through card progression", () => {
    const root = CARD_BY_ID[CARD_ROOT_ID];
    const save = { ...defaultSave(), gold: root.cost + 5 };

    expect(canUnlockCard(save, CARD_ROOT_ID)).toBe(true);

    const unlocked = unlockCard(save, CARD_ROOT_ID);

    expect(unlocked.gold).toBe(5);
    expect(isCardUnlocked(unlocked, CARD_ROOT_ID)).toBe(true);
    expect(unlocked.unlockedCards[CARD_ROOT_ID]).toBe(1);
  });

  it("adds category classes to upgrade tree edges", () => {
    const card = CARD_BY_ID.sharp_edge_1;

    expect(getUpgradeTreeEdgeClass(card, false)).toContain("category-equipment");
    expect(getUpgradeTreeEdgeClass(card, false)).toContain("branch-blade");
    expect(getUpgradeTreeEdgeClass(card, false)).toContain("is-visible");
  });

  it("draws an edge only when both child and parent are revealed", () => {
    const card = CARD_BY_ID.cyclone_cut;
    const revealed = new Set(["cyclone_cut", "clean_sweep_2"]);

    expect(shouldDrawUpgradeTreeEdge(card, "clean_sweep_2", revealed)).toBe(true);
    expect(shouldDrawUpgradeTreeEdge(card, "quick_recovery_2", revealed)).toBe(false);
  });
});
