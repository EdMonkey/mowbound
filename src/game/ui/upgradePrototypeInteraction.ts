export const UPGRADE_LONG_PRESS_MS = 520;

export interface UpgradePrototypePointerPolicyInput {
  pointerType: string;
  button: number;
  pointerCount: number;
  startedOnNode?: boolean;
}

export function shouldShowUpgradeHoverDetail(pointerType: string): boolean {
  return pointerType === "mouse";
}

export function shouldShowUpgradeLongPressDetail(pointerType: string): boolean {
  return pointerType === "touch";
}

export function shouldPanUpgradePrototype(input: UpgradePrototypePointerPolicyInput): boolean {
  if (input.pointerType === "mouse") {
    return input.button === 2;
  }
  if (input.pointerType === "touch") {
    return input.pointerCount >= 2 || !input.startedOnNode;
  }
  return false;
}

export function getUpgradePrototypePinchZoom(previousDistance: number, nextDistance: number): number {
  if (previousDistance <= 0 || nextDistance <= 0) {
    return 1;
  }
  return nextDistance / previousDistance;
}

interface UpgradePrototypeTooltipPositionInput {
  pointX: number;
  pointY: number;
  detailWidth: number;
  detailHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
}

export function getUpgradePrototypeTooltipPosition(input: UpgradePrototypeTooltipPositionInput): { left: number; top: number } {
  const left = Math.max(8, Math.min(input.pointX - input.detailWidth / 2, input.viewportWidth - input.detailWidth - 8));
  const preferredTop = input.pointY - input.detailHeight - input.offset;
  const top = preferredTop >= 8 ? preferredTop : Math.min(input.pointY + input.offset, input.viewportHeight - input.detailHeight - 8);
  return {
    left,
    top: Math.max(8, top),
  };
}
