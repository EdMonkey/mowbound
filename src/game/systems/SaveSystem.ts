import { BALANCE, type RuntimeStats, type SaveData, type SkillId, SKILL_DEFS, defaultSave } from "../config/balance";

const STORAGE_KEY = "mowbound-save-v1";

function normalizeSave(value: unknown): SaveData {
  const fallback = defaultSave();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<SaveData>;
  const skills = { ...fallback.skills, ...(candidate.skills ?? {}) };

  for (const key of Object.keys(skills) as SkillId[]) {
    const level = Number(skills[key]);
    skills[key] = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  }

  const totalGold = Number(candidate.totalGold);

  return {
    totalGold: Number.isFinite(totalGold) && totalGold > 0 ? Math.floor(totalGold) : 0,
    skills,
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

export function getSkillCost(save: SaveData, skillId: SkillId): number {
  const definition = SKILL_DEFS[skillId];
  const level = save.skills[skillId];

  if (level >= definition.maxLevel) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(definition.baseCost * Math.pow(definition.costGrowth, level));
}

export function canPurchaseSkill(save: SaveData, skillId: SkillId): boolean {
  return save.totalGold >= getSkillCost(save, skillId);
}

export function purchaseSkill(save: SaveData, skillId: SkillId): SaveData {
  const cost = getSkillCost(save, skillId);

  if (!Number.isFinite(cost) || save.totalGold < cost) {
    return normalizeSave(save);
  }

  return normalizeSave({
    totalGold: save.totalGold - cost,
    skills: {
      ...save.skills,
      [skillId]: save.skills[skillId] + 1,
    },
  });
}

export function addGold(save: SaveData, amount: number): SaveData {
  return normalizeSave({
    ...save,
    totalGold: save.totalGold + Math.max(0, Math.floor(amount)),
  });
}

export function getRuntimeStats(save: SaveData): RuntimeStats {
  const skills = normalizeSave(save).skills;

  const attackIntervalMs = Math.max(BALANCE.minAttackIntervalMs, BALANCE.baseAttackIntervalMs - skills.attackSpeed * 35);

  return {
    attackDamage: BALANCE.baseAttackDamage + skills.damage,
    attackRangeMeters: BALANCE.baseAttackRangeMeters + skills.range * 0.15,
    attackArcDegrees: BALANCE.baseAttackArcDegrees,
    attackChargeDurationMs: attackIntervalMs,
    attackIntervalMs,
    moveSpeed: BALANCE.playerMoveSpeed + skills.moveSpeed * 0.22,
    goldPerGrass: BALANCE.baseGoldPerGrass + skills.goldValue,
    initialGrassCount: BALANCE.initialGrassCount + skills.grassDensity * 3,
    grassSpawnIntervalMs: Math.max(140, BALANCE.grassSpawnIntervalMs - skills.grassDensity * 8),
    grassSpawnPerTick: BALANCE.grassSpawnPerTick,
  };
}

export { defaultSave, STORAGE_KEY };
