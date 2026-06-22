import { describe, expect, it } from "vitest";
import {
  shouldPanUpgradePrototype,
  shouldShowUpgradeHoverDetail,
  shouldShowUpgradeLongPressDetail,
} from "../src/game/ui/upgradePrototypeInteraction";

describe("upgrade prototype interaction policy", () => {
  it("uses hover detail only for desktop mouse pointers", () => {
    expect(shouldShowUpgradeHoverDetail("mouse")).toBe(true);
    expect(shouldShowUpgradeHoverDetail("touch")).toBe(false);
    expect(shouldShowUpgradeHoverDetail("pen")).toBe(false);
  });

  it("uses long press detail only for mobile touch pointers", () => {
    expect(shouldShowUpgradeLongPressDetail("touch")).toBe(true);
    expect(shouldShowUpgradeLongPressDetail("mouse")).toBe(false);
    expect(shouldShowUpgradeLongPressDetail("pen")).toBe(false);
  });

  it("pans with right mouse button on desktop and two touch pointers on mobile", () => {
    expect(shouldPanUpgradePrototype({ pointerType: "mouse", button: 2, pointerCount: 1 })).toBe(true);
    expect(shouldPanUpgradePrototype({ pointerType: "mouse", button: 0, pointerCount: 1 })).toBe(false);
    expect(shouldPanUpgradePrototype({ pointerType: "touch", button: 0, pointerCount: 1 })).toBe(false);
    expect(shouldPanUpgradePrototype({ pointerType: "touch", button: 0, pointerCount: 2 })).toBe(true);
  });
});
