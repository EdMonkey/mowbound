interface VisibleTotalGoldInput {
  savedGold: number;
  roundGold: number;
  roundBanked: boolean;
}

export function visibleTotalGold(input: VisibleTotalGoldInput): number {
  const savedGold = Math.max(0, Math.floor(input.savedGold));
  const roundGold = Math.max(0, Math.floor(input.roundGold));
  return input.roundBanked ? savedGold : savedGold + roundGold;
}
