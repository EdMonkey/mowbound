export const BALANCE = {
  roundDurationMs: 4000,
  mapSizeMeters: 10,
  playerMoveSpeed: 2.8,
  baseAttackDamage: 3,
  baseGrassHp: 5,
  baseAttackIntervalMs: 500,
  baseAttackRangeMeters: 1,
  baseAttackArcDegrees: 90,
  attackChargeDurationMs: 500,
  baseGoldPerGrass: 1,
  initialGrassCount: 18,
  grassSpawnIntervalMs: 320,
  grassSpawnPerTick: 1,
  virtualJoystickRadiusPx: 64,
  virtualJoystickDeadZone: 0.12,
  mouseMoveDeadZonePx: 24,
  minAttackIntervalMs: 150,
} as const;

export type SkillId = "damage" | "range" | "attackSpeed" | "moveSpeed" | "goldValue" | "grassDensity";

export interface SaveData {
  totalGold: number;
  skills: Record<SkillId, number>;
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export interface RuntimeStats {
  attackDamage: number;
  attackRangeMeters: number;
  attackArcDegrees: number;
  attackChargeDurationMs: number;
  attackIntervalMs: number;
  moveSpeed: number;
  goldPerGrass: number;
  initialGrassCount: number;
  grassSpawnIntervalMs: number;
  grassSpawnPerTick: number;
}

export const SKILL_DEFS: Record<SkillId, SkillDefinition> = {
  damage: {
    id: "damage",
    name: "Damage Up",
    description: "Scythe damage +1.",
    baseCost: 6,
    costGrowth: 1.55,
    maxLevel: 30,
  },
  range: {
    id: "range",
    name: "Range Up",
    description: "Forward fan range +0.15m.",
    baseCost: 7,
    costGrowth: 1.6,
    maxLevel: 20,
  },
  attackSpeed: {
    id: "attackSpeed",
    name: "Attack Speed Up",
    description: "Attack interval decreases toward 0.15s.",
    baseCost: 9,
    costGrowth: 1.7,
    maxLevel: 10,
  },
  moveSpeed: {
    id: "moveSpeed",
    name: "Move Speed Up",
    description: "Movement speed increases.",
    baseCost: 5,
    costGrowth: 1.5,
    maxLevel: 20,
  },
  goldValue: {
    id: "goldValue",
    name: "Gold Value Up",
    description: "Each grass grants +1 gold.",
    baseCost: 12,
    costGrowth: 1.8,
    maxLevel: 20,
  },
  grassDensity: {
    id: "grassDensity",
    name: "Grass Density Up",
    description: "More grass at start and during runs.",
    baseCost: 8,
    costGrowth: 1.55,
    maxLevel: 18,
  },
};

export function defaultSave(): SaveData {
  return {
    totalGold: 0,
    skills: {
      damage: 0,
      range: 0,
      attackSpeed: 0,
      moveSpeed: 0,
      goldValue: 0,
      grassDensity: 0,
    },
  };
}
