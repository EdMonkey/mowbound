import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARD_ROOT_ID, CARDS } from "../src/game/config/cards";
import {
  canUnlockCard,
  getRevealedCards,
  isCardUnlocked,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";
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
});
