export const CARD_DETAIL_LONG_PRESS_MS = 520;
export const CARD_DETAIL_TAP_MOVE_PX = 8;

export function shouldOpenCardDetailFromClick(pointerType: string): boolean {
  return pointerType === "mouse";
}

export function shouldOpenCardDetailFromLongPress(pointerType: string, pressMs: number, moved: boolean): boolean {
  return (pointerType === "touch" || pointerType === "pen") && pressMs >= CARD_DETAIL_LONG_PRESS_MS && !moved;
}
