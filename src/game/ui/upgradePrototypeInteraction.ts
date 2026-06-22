export const UPGRADE_LONG_PRESS_MS = 520;

export interface UpgradePrototypePointerPolicyInput {
  pointerType: string;
  button: number;
  pointerCount: number;
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
    return input.pointerCount >= 2;
  }
  return false;
}
