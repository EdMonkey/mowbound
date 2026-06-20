export interface EconomyStats {
  goldDivisor: number;
  goldMultiplier: number;
  grassScoreMultiplier: number;
  cleanPatchScore: number;
  clearBonusPercent: number;
  rockScore: number;
  treeScore: number;
  bombChainScore: number;
  firstBombScoreMultiplier: number;
  obstacleScoreMultiplier: number;
  largeMapBonusCap: number;
}

export type RunScoreEvent =
  | { kind: "grassCut"; count: number }
  | { kind: "cleanPatch"; count: number }
  | { kind: "rockBroken"; count: number }
  | { kind: "treeBroken"; count: number }
  | { kind: "bombChain"; chainLength: number; firstBomb: boolean }
  | { kind: "clearPercent"; percent: number; mapSize: number };

export interface RunScoreBreakdown {
  grass: number;
  cleanRows: number;
  obstacles: number;
  bombChains: number;
  clearBonus: number;
}

export interface RunScoreResult {
  totalScore: number;
  breakdown: RunScoreBreakdown;
}

const CLEAR_MILESTONES = [
  { percent: 5, score: 10 },
  { percent: 10, score: 25 },
  { percent: 20, score: 60 },
  { percent: 35, score: 130 },
  { percent: 50, score: 240 },
] as const;

function count(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function clearPercentScore(percent: number, clearBonusPercent: number, largeMapBonusCap = 1): number {
  const base = CLEAR_MILESTONES.reduce(
    (sum, milestone) => (percent >= milestone.percent ? sum + milestone.score : sum),
    0,
  );
  const boosted = Math.floor(base * (1 + Math.max(0, clearBonusPercent) / 100));
  return Math.floor(boosted * Math.max(0, largeMapBonusCap));
}

export function detectCleanPatchCount(cutTimesMs: number[], windowMs: number, threshold: number): number {
  const sorted = [...cutTimesMs].sort((a, b) => a - b);
  let patches = 0;
  let start = 0;

  for (let end = 0; end < sorted.length; end += 1) {
    while (sorted[end] - sorted[start] > windowMs) {
      start += 1;
    }

    if (end - start + 1 >= threshold) {
      patches += 1;
      start = end + 1;
    }
  }

  return patches;
}

export function scoreRun(events: RunScoreEvent[], stats: EconomyStats): RunScoreResult {
  const breakdown: RunScoreBreakdown = {
    grass: 0,
    cleanRows: 0,
    obstacles: 0,
    bombChains: 0,
    clearBonus: 0,
  };

  for (const event of events) {
    switch (event.kind) {
      case "grassCut":
        breakdown.grass += count(event.count) * stats.grassScoreMultiplier;
        break;
      case "cleanPatch":
        breakdown.cleanRows += count(event.count) * stats.cleanPatchScore;
        break;
      case "rockBroken":
        breakdown.obstacles += count(event.count) * stats.rockScore * stats.obstacleScoreMultiplier;
        break;
      case "treeBroken":
        breakdown.obstacles += count(event.count) * stats.treeScore * stats.obstacleScoreMultiplier;
        break;
      case "bombChain": {
        const extraBombs = Math.max(0, count(event.chainLength) - 1);
        const multiplier = event.firstBomb ? stats.firstBombScoreMultiplier : 1;
        breakdown.bombChains += Math.floor(extraBombs * stats.bombChainScore * multiplier);
        break;
      }
      case "clearPercent":
        breakdown.clearBonus += clearPercentScore(
          event.percent,
          stats.clearBonusPercent,
          event.mapSize > 10 ? stats.largeMapBonusCap : 1,
        );
        break;
    }
  }

  const totalScore = Math.floor(
    breakdown.grass + breakdown.cleanRows + breakdown.obstacles + breakdown.bombChains + breakdown.clearBonus,
  );
  return { totalScore, breakdown };
}

export function goldFromScore(score: number, stats: EconomyStats): number {
  return Math.floor(Math.max(0, score) / Math.max(1, stats.goldDivisor)) * stats.goldMultiplier;
}

export function rewardForGrass(stats: { goldPerGrass?: number }, destroyedCount: number): number {
  return (stats.goldPerGrass ?? 1) * Math.max(0, Math.floor(destroyedCount));
}
