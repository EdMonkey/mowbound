import { describe, expect, it } from "vitest";
import {
  CARD_DETAIL_LONG_PRESS_MS,
  shouldOpenCardDetailFromClick,
  shouldOpenCardDetailFromLongPress,
} from "../src/game/ui/cardCatalogInteraction";

describe("card catalog interaction policy", () => {
  it("keeps mouse rows quick to inspect with a normal click", () => {
    expect(shouldOpenCardDetailFromClick("mouse")).toBe(true);
  });

  it("keeps touch card rows as a list unless the player long-presses", () => {
    expect(shouldOpenCardDetailFromClick("touch")).toBe(false);
    expect(shouldOpenCardDetailFromLongPress("touch", CARD_DETAIL_LONG_PRESS_MS - 1, false)).toBe(false);
    expect(shouldOpenCardDetailFromLongPress("touch", CARD_DETAIL_LONG_PRESS_MS, false)).toBe(true);
    expect(shouldOpenCardDetailFromLongPress("touch", CARD_DETAIL_LONG_PRESS_MS + 120, true)).toBe(false);
  });
});
