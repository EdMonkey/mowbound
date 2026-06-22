import { describe, expect, it } from "vitest";
import {
  getUpgradePrototypeEditedNodePosition,
  getUpgradePrototypeTooltipPosition,
  getUpgradePrototypePinchZoom,
  shouldKeepUpgradePrototypePanAfterPointerEnd,
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

  it("places upgrade detail tooltip above the pointer when there is room", () => {
    const position = getUpgradePrototypeTooltipPosition({
      pointX: 180,
      pointY: 300,
      detailWidth: 160,
      detailHeight: 90,
      viewportWidth: 390,
      viewportHeight: 640,
      offset: 12,
    });

    expect(position.top + 90).toBeLessThanOrEqual(288);
    expect(position.left).toBe(100);
  });

  it("stops panning when a two-finger pinch drops to one remaining touch", () => {
    expect(
      shouldKeepUpgradePrototypePanAfterPointerEnd({
        pointerType: "touch",
        remainingPointerCount: 1,
        wasPinching: true,
      }),
    ).toBe(false);
  });

  it("converts edit-mode node dragging from screen pixels into clamped world coordinates", () => {
    expect(
      getUpgradePrototypeEditedNodePosition({
        startWorldX: 200,
        startWorldY: 300,
        pointerStartX: 100,
        pointerStartY: 100,
        pointerX: 160,
        pointerY: 70,
        zoom: 2,
        minX: 0,
        maxX: 500,
        minY: 0,
        maxY: 500,
      }),
    ).toEqual({ x: 230, y: 285 });

    expect(
      getUpgradePrototypeEditedNodePosition({
        startWorldX: 20,
        startWorldY: 20,
        pointerStartX: 100,
        pointerStartY: 100,
        pointerX: -200,
        pointerY: -200,
        zoom: 1,
        minX: 0,
        maxX: 500,
        minY: 0,
        maxY: 500,
      }),
    ).toEqual({ x: 0, y: 0 });
  });
});
