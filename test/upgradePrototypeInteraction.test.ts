import { describe, expect, it } from "vitest";
import {
  getUpgradePrototypePinchZoom,
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

  it("pans with right mouse button on desktop and one touch pointer on empty mobile space", () => {
    expect(shouldPanUpgradePrototype({ pointerType: "mouse", button: 2, pointerCount: 1 })).toBe(true);
    expect(shouldPanUpgradePrototype({ pointerType: "mouse", button: 0, pointerCount: 1 })).toBe(false);
    expect(shouldPanUpgradePrototype({ pointerType: "touch", button: 0, pointerCount: 1, startedOnNode: false })).toBe(true);
    expect(shouldPanUpgradePrototype({ pointerType: "touch", button: 0, pointerCount: 1, startedOnNode: true })).toBe(false);
    expect(shouldPanUpgradePrototype({ pointerType: "touch", button: 0, pointerCount: 2 })).toBe(true);
  });

  it("zooms out when pinch distance shrinks and zooms in when it grows", () => {
    expect(getUpgradePrototypePinchZoom(100, 50)).toBe(0.5);
    expect(getUpgradePrototypePinchZoom(100, 150)).toBe(1.5);
    expect(getUpgradePrototypePinchZoom(0, 150)).toBe(1);
  });
});
