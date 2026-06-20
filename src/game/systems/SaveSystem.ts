import { BALANCE, type RuntimeStats } from "../config/balance";
import {
  SKILL_NODE_BY_ID,
  SKILL_NODES,
  type SkillEffect,
  type ToolId,
} from "../config/skillTree";

export const STORAGE_KEY = "mowbound-save-v2";
export const OLD_STORAGE_KEY = "mowbound-save-v1";

export interface LifetimeStats {
  grassCut: number;
  rocksBroken: number;
  treesCut: number;
  bombsTriggered: number;
  bestBombChain: number;
  bestClearPercentByMap: Record<string, number>;
}

export interface SaveData {
  schemaVersion: 2;
  gold: number;
  levels: Record<string, number>;
  selectedTool: ToolId;
  lifetimeStats: LifetimeStats;
}

export interface RunSaveResult {
  gold: number;
  grassCut: number;
  rocksBroken: number;
  treesCut: number;
  bombsTriggered: number;
  bestBombChain: number;
  mapSize: number;
  clearPercent: number;
}

const VALID_IDS = new Set(SKILL_NODES.map((node) => node.id));
const TOOL_IDS = new Set<ToolId>(["default", "wide_sickle", "fast_sickle", "bomb_sickle", "tractor"]);

const LEGACY_UNLOCK_MAP: Record<string, string> = {
  dmg1: "root_sharpen",
  dmg2: "sharp_edge_1",
  dmg3: "heavy_edge",
  reach: "clean_sweep_1",
  swift: "quick_recovery_1",
  swift2: "quick_recovery_2",
  foot: "light_boots_1",
  foot2: "light_boots_2",
  time1: "field_rhythm_1",
  time2: "field_rhythm_2",
  gold1: "market_cart_1",
  gold2: "market_cart_2",
  dense: "dense_growth",
};

export function defaultSave(): SaveData {
  return {
    schemaVersion: 2,
    gold: 0,
    levels: {},
    selectedTool: "default",
    lifetimeStats: {
      grassCut: 0,
      rocksBroken: 0,
      treesCut: 0,
      bombsTriggered: 0,
      bestBombChain: 0,
      bestClearPercentByMap: {},
    },
  };
}

function positiveInt(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0;
}

function normalizeLevels(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [id, level] of Object.entries(value as Record<string, unknown>)) {
    if (VALID_IDS.has(id) && positiveInt(level) > 0) {
      result[id] = 1;
    }
  }
  return result;
}

function normalizeLifetimeStats(value: unknown): LifetimeStats {
  const fallback = defaultSave().lifetimeStats;
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<LifetimeStats>;
  const bestClearPercentByMap: Record<string, number> = {};
  if (candidate.bestClearPercentByMap && typeof candidate.bestClearPercentByMap === "object") {
    for (const [mapSize, percent] of Object.entries(candidate.bestClearPercentByMap)) {
      bestClearPercentByMap[mapSize] = positiveInt(percent);
    }
  }

  return {
    grassCut: positiveInt(candidate.grassCut),
    rocksBroken: positiveInt(candidate.rocksBroken),
    treesCut: positiveInt(candidate.treesCut),
    bombsTriggered: positiveInt(candidate.bombsTriggered),
    bestBombChain: positiveInt(candidate.bestBombChain),
    bestClearPercentByMap,
  };
}

function normalizeLegacySave(candidate: Record<string, unknown>): SaveData {
  const save = defaultSave();
  save.gold = positiveInt(candidate.totalGold);

  if (Array.isArray(candidate.unlocked)) {
    for (const oldId of candidate.unlocked) {
      if (typeof oldId !== "string") {
        continue;
      }
      const mapped = LEGACY_UNLOCK_MAP[oldId] ?? oldId;
      if (VALID_IDS.has(mapped)) {
        save.levels[mapped] = 1;
      }
    }
  }

  return save;
}

export function normalizeSave(value: unknown): SaveData {
  if (!value || typeof value !== "object") {
    return defaultSave();
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 2) {
    return normalizeLegacySave(candidate);
  }

  const selectedTool = typeof candidate.selectedTool === "string" && TOOL_IDS.has(candidate.selectedTool as ToolId)
    ? candidate.selectedTool as ToolId
    : "default";

  return {
    schemaVersion: 2,
    gold: positiveInt(candidate.gold),
    levels: normalizeLevels(candidate.levels),
    selectedTool,
    lifetimeStats: normalizeLifetimeStats(candidate.lifetimeStats),
  };
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSave(JSON.parse(raw));
    }

    const oldRaw = window.localStorage.getItem(OLD_STORAGE_KEY);
    return normalizeSave(oldRaw ? JSON.parse(oldRaw) : null);
  } catch {
    return defaultSave();
  }
}

export function saveGame(save: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSave(save)));
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function unlockAllSkillsForTest(save: SaveData): SaveData {
  const normalized = normalizeSave(save);
  return normalizeSave({
    ...normalized,
    levels: Object.fromEntries(SKILL_NODES.map((node) => [node.id, 1])),
  });
}

export function applyRunResultToSave(save: SaveData, result: RunSaveResult): SaveData {
  const normalized = normalizeSave(save);
  const mapKey = String(result.mapSize);
  const bestClear = normalized.lifetimeStats.bestClearPercentByMap[mapKey] ?? 0;

  return normalizeSave({
    ...normalized,
    gold: normalized.gold + positiveInt(result.gold),
    lifetimeStats: {
      grassCut: normalized.lifetimeStats.grassCut + positiveInt(result.grassCut),
      rocksBroken: normalized.lifetimeStats.rocksBroken + positiveInt(result.rocksBroken),
      treesCut: normalized.lifetimeStats.treesCut + positiveInt(result.treesCut),
      bombsTriggered: normalized.lifetimeStats.bombsTriggered + positiveInt(result.bombsTriggered),
      bestBombChain: Math.max(normalized.lifetimeStats.bestBombChain, positiveInt(result.bestBombChain)),
      bestClearPercentByMap: {
        ...normalized.lifetimeStats.bestClearPercentByMap,
        [mapKey]: Math.max(bestClear, positiveInt(result.clearPercent)),
      },
    },
  });
}

export function isNodeUnlocked(save: SaveData, nodeId: string): boolean {
  return (normalizeSave(save).levels[nodeId] ?? 0) > 0;
}

export function isNodeRevealed(save: SaveData, nodeId: string): boolean {
  const node = SKILL_NODE_BY_ID[nodeId];
  if (!node) {
    return false;
  }
  return node.prereq.length === 0 || node.prereq.every((prereq) => isNodeUnlocked(save, prereq));
}

export function getNodeCost(nodeId: string): number {
  return SKILL_NODE_BY_ID[nodeId]?.cost ?? Number.POSITIVE_INFINITY;
}

export function canUnlockNode(save: SaveData, nodeId: string): boolean {
  const normalized = normalizeSave(save);
  return (
    isNodeRevealed(normalized, nodeId) &&
    !isNodeUnlocked(normalized, nodeId) &&
    normalized.gold >= getNodeCost(nodeId)
  );
}

export function unlockNode(save: SaveData, nodeId: string): SaveData {
  const normalized = normalizeSave(save);
  if (!canUnlockNode(normalized, nodeId)) {
    return normalized;
  }

  return normalizeSave({
    ...normalized,
    gold: normalized.gold - getNodeCost(nodeId),
    levels: {
      ...normalized.levels,
      [nodeId]: 1,
    },
  });
}

export function addGold(save: SaveData, amount: number): SaveData {
  const normalized = normalizeSave(save);
  return normalizeSave({
    ...normalized,
    gold: normalized.gold + Math.max(0, Math.floor(amount)),
  });
}

function applyRuntimeEffect(total: Record<string, number>, effect: SkillEffect): void {
  switch (effect.kind) {
    case "attackDamage":
      total.damage += effect.amount;
      break;
    case "attackRange":
      total.range += effect.amount;
      break;
    case "attackInterval":
      total.attackInterval += effect.amount;
      break;
    case "moveSpeed":
      total.moveSpeed += effect.amount;
      break;
    case "initialGrassCount":
      total.grassCount += effect.amount;
      break;
    case "roundDurationPercent":
      total.roundDurationPercent += effect.amount;
      break;
  }
}

export function getRuntimeStats(save: SaveData): RuntimeStats {
  const normalized = normalizeSave(save);
  const total: Record<string, number> = {
    damage: 0,
    range: 0,
    attackInterval: 0,
    moveSpeed: 0,
    grassCount: 0,
    roundDurationPercent: 0,
  };

  for (const node of SKILL_NODES) {
    if (isNodeUnlocked(normalized, node.id)) {
      for (const effect of node.effects) {
        applyRuntimeEffect(total, effect);
      }
    }
  }

  const attackIntervalMs = Math.max(
    BALANCE.minAttackIntervalMs,
    BALANCE.baseAttackIntervalMs + total.attackInterval,
  );
  const roundDurationMs = Math.round(BALANCE.roundDurationMs * (1 + total.roundDurationPercent / 100));

  return {
    attackDamage: BALANCE.baseAttackDamage + total.damage,
    attackRangeMeters: BALANCE.baseAttackRangeMeters + total.range,
    attackArcDegrees: BALANCE.baseAttackArcDegrees,
    attackChargeDurationMs: attackIntervalMs,
    attackIntervalMs,
    moveSpeed: BALANCE.playerMoveSpeed + total.moveSpeed,
    goldPerGrass: BALANCE.baseGoldPerGrass,
    initialGrassCount: BALANCE.initialGrassCount + total.grassCount,
    grassSpawnIntervalMs: BALANCE.grassSpawnIntervalMs,
    grassSpawnPerTick: BALANCE.grassSpawnPerTick,
    roundDurationMs,
  };
}
