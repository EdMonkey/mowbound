import {
  goldFromScore,
  scoreRun,
  type EconomyStats,
  type RunScoreEvent,
  type RunScoreResult,
} from "./EconomySystem";
import type { RunSaveResult } from "./SaveSystem";

export interface RunSummary extends RunSaveResult {
  score: RunScoreResult;
}

export function summarizeRun(
  events: RunScoreEvent[],
  economyStats: EconomyStats,
  mapSize: number,
): RunSummary {
  const score = scoreRun(events, economyStats);
  const gold = goldFromScore(score.totalScore, economyStats);
  let grassCut = 0;
  let rocksBroken = 0;
  let treesCut = 0;
  let bombsTriggered = 0;
  let bestBombChain = 0;
  let clearPercent = 0;

  for (const event of events) {
    switch (event.kind) {
      case "grassCut":
        grassCut += event.count;
        break;
      case "rockBroken":
        rocksBroken += event.count;
        break;
      case "treeBroken":
        treesCut += event.count;
        break;
      case "bombChain":
        bombsTriggered += event.chainLength;
        bestBombChain = Math.max(bestBombChain, event.chainLength);
        break;
      case "clearPercent":
        clearPercent = Math.max(clearPercent, event.percent);
        break;
      case "cleanPatch":
        break;
    }
  }

  return {
    score,
    gold,
    grassCut,
    rocksBroken,
    treesCut,
    bombsTriggered,
    bestBombChain,
    mapSize,
    clearPercent,
  };
}
