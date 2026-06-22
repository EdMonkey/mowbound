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

interface UpgradePrototypePanEndInput {
  pointerType: string;
  remainingPointerCount: number;
  wasPinching: boolean;
}

export function shouldKeepUpgradePrototypePanAfterPointerEnd(input: UpgradePrototypePanEndInput): boolean {
  if (input.remainingPointerCount <= 0) {
    return false;
  }
  if (input.pointerType === "touch" && input.wasPinching && input.remainingPointerCount < 2) {
    return false;
  }
  return true;
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

interface UpgradePrototypeEditDragInput {
  startWorldX: number;
  startWorldY: number;
  pointerStartX: number;
  pointerStartY: number;
  pointerX: number;
  pointerY: number;
  zoom: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getUpgradePrototypeEditedNodePosition(input: UpgradePrototypeEditDragInput): { x: number; y: number } {
  const zoom = Math.max(0.0001, input.zoom);
  return {
    x: clamp(input.startWorldX + (input.pointerX - input.pointerStartX) / zoom, input.minX, input.maxX),
    y: clamp(input.startWorldY + (input.pointerY - input.pointerStartY) / zoom, input.minY, input.maxY),
  };
}
