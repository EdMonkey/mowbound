export const BALANCE = {
  roundDurationMs: 10000,
  // Base map is 10x10; the menu lets the player pick a larger map (see
  // MAP_SIZE_OPTIONS / App.mapSizeMeters). Grass count scales with area so
  // density stays at 16/m^2 regardless of the chosen size.
  mapSizeMeters: 10,
  playerMoveSpeed: 0.7,
  baseAttackDamage: 3,
  baseGrassHp: 5,
  baseAttackIntervalMs: 1000,
  baseAttackRangeMeters: 0.5,
  baseAttackArcDegrees: 360,
  attackChargeDurationMs: 1000,
  baseGoldPerGrass: 1,
  initialGrassCount: 1600,
  grassSpawnIntervalMs: 320,
  grassSpawnPerTick: 0,
  virtualJoystickRadiusPx: 64,
  virtualJoystickDeadZone: 0.12,
  minAttackIntervalMs: 150,
  // Bomb skill: touch a bomb to set off a circular blast that mows all grass
  // within `bombBlastRadiusMeters`; other bombs within the (smaller) chain
  // radius detonate too. Test bombs are scattered at run start, see
  // TEST_BOMB_COUNTS. Per-map counts/durations live in the lookups below.
  bombBlastRadiusMeters: 1.25,
  bombChainRadiusMeters: 2.5,
  bombTriggerRadiusMeters: 0.7,
  bombChainDelayMs: 110,
  bombMaxCoinsPerBlast: 30,
  bombMaxClippingsPerBlast: 40,
  // Rocks & trees: all-or-nothing. A hit only breaks one if its damage is
  // strictly greater than the obstacle HP. A hit that fails to break one
  // recoils the player: knockback away from it + a red flash + a stun.
  obstacleHp: 5,
  obstacleStunSeconds: 2,
  obstacleKnockbackSpeed: 4.2,
} as const;

/** Test bombs scattered at run start, per selected map size (meters/side). */
export const TEST_BOMB_COUNTS: Record<number, number> = { 10: 0, 30: 30 };

/** Test rocks/trees scattered per map size: how many of each to spread around. */
export const OBSTACLE_COUNTS_BY_MAP: Record<number, { rocks: number; trees: number }> = {
  10: { rocks: 5, trees: 4 },
  30: { rocks: 22, trees: 18 },
};

/** Base round duration per map size (ms); skill bonuses add on top. */
export const ROUND_DURATION_BY_MAP: Record<number, number> = { 10: 10000, 30: 30000 };

/** Selectable map sizes (meters per side) offered on the main menu. */
export const MAP_SIZE_OPTIONS = [10, 30] as const;

export interface SaveData {
  totalGold: number;
  unlocked: string[];
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
  roundDurationMs: number;
}

export {
  SKILL_NODES,
  SKILL_NODE_BY_ID,
  SKILL_ROOT,
  type SkillEffect,
  type SkillNode,
} from "./skillTree";

export function defaultSave(): SaveData {
  return {
    totalGold: 0,
    unlocked: [],
  };
}
