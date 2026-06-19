import {
  BALANCE,
  type RuntimeStats,
  type SaveData,
  SKILL_NODES,
  SKILL_NODE_BY_ID,
  defaultSave,
} from "../config/balance";

const STORAGE_KEY = "mowbound-save-v1";
const VALID_IDS = new Set(SKILL_NODES.map((node) => node.id));

function normalizeSave(value: unknown): SaveData {
  const fallback = defaultSave();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<SaveData>;
  const unlocked = Array.isArray(candidate.unlocked)
    ? [...new Set(candidate.unlocked.filter((id): id is string => typeof id === "string" && VALID_IDS.has(id)))]
    : [];

  const totalGold = Number(candidate.totalGold);

  return {
    totalGold: Number.isFinite(totalGold) && totalGold > 0 ? Math.floor(totalGold) : 0,
    unlocked,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeSave(raw ? JSON.parse(raw) : null);
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

export function isNodeUnlocked(save: SaveData, nodeId: string): boolean {
  return normalizeSave(save).unlocked.includes(nodeId);
}

export function isNodeRevealed(save: SaveData, nodeId: string): boolean {
  const node = SKILL_NODE_BY_ID[nodeId];
  if (!node) {
    return false;
  }
  return node.prereq === null || isNodeUnlocked(save, node.prereq);
}

export function getNodeCost(nodeId: string): number {
  return SKILL_NODE_BY_ID[nodeId]?.cost ?? Number.POSITIVE_INFINITY;
}

export function canUnlockNode(save: SaveData, nodeId: string): boolean {
  return (
    isNodeRevealed(save, nodeId) &&
    !isNodeUnlocked(save, nodeId) &&
    save.totalGold >= getNodeCost(nodeId)
  );
}

export function unlockNode(save: SaveData, nodeId: string): SaveData {
  if (!canUnlockNode(save, nodeId)) {
    return normalizeSave(save);
  }
  return normalizeSave({
    totalGold: save.totalGold - getNodeCost(nodeId),
    unlocked: [...save.unlocked, nodeId],
  });
}

export function addGold(save: SaveData, amount: number): SaveData {
  return normalizeSave({
    ...save,
    totalGold: save.totalGold + Math.max(0, Math.floor(amount)),
  });
}

export function getRuntimeStats(save: SaveData): RuntimeStats {
  const unlocked = new Set(normalizeSave(save).unlocked);
  const total: Record<string, number> = {
    damage: 0,
    range: 0,
    arc: 0,
    attackInterval: 0,
    moveSpeed: 0,
    gold: 0,
    grassCount: 0,
    roundDuration: 0,
  };

  for (const node of SKILL_NODES) {
    if (node.effect && unlocked.has(node.id)) {
      total[node.effect.kind] += node.effect.amount;
    }
  }

  const attackIntervalMs = Math.max(
    BALANCE.minAttackIntervalMs,
    BALANCE.baseAttackIntervalMs + total.attackInterval,
  );

  return {
    attackDamage: BALANCE.baseAttackDamage + total.damage,
    attackRangeMeters: BALANCE.baseAttackRangeMeters + total.range,
    attackArcDegrees: BALANCE.baseAttackArcDegrees + total.arc,
    attackChargeDurationMs: attackIntervalMs,
    attackIntervalMs,
    moveSpeed: BALANCE.playerMoveSpeed + total.moveSpeed,
    goldPerGrass: BALANCE.baseGoldPerGrass + total.gold,
    initialGrassCount: BALANCE.initialGrassCount + total.grassCount,
    grassSpawnIntervalMs: BALANCE.grassSpawnIntervalMs,
    grassSpawnPerTick: BALANCE.grassSpawnPerTick,
    roundDurationMs: BALANCE.roundDurationMs + total.roundDuration,
  };
}

export { defaultSave, STORAGE_KEY };
