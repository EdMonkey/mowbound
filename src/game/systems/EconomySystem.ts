import type { RuntimeStats } from "../config/balance";

export function rewardForGrass(stats: RuntimeStats, destroyedCount: number): number {
  return stats.goldPerGrass * Math.max(0, Math.floor(destroyedCount));
}
