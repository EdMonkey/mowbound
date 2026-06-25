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
  fireIgniteChance: 0.05,
  fireDamagePerSecond: 2.5,
  fireDurationSeconds: 5,
  fireSpreadRadiusMeters: 0.48,
  fireSpreadChancePerSecond: 0.22,
  fireSpreadDurationMultiplier: 0.65,
  fireSpreadMinDurationSeconds: 0.6,
  tallGrassHpMultiplier: 2,
  tallGrassYScale: 1.5,
  blueGrassSlowFactor: 0.33,
  timerGrassRestoreSeconds: 4,
  timerGrassCount: 7,
  grassRegrowDelaySeconds: 12,
  grassRegrowDurationSeconds: 8,
} as const;

/**
 * Base values for each summoned auto-ability. Cards add deltas on top of
 * these (see CardEffectSystem.getRuntimeStats). `damageFactor` is multiplied by the
 * player's attack damage; `intervalSec` is the spawn cooldown.
 */
export interface SummonBase {
  damageFactor: number;
  intervalSec: number;
  minIntervalSec: number;
  radius: number;
  spins: number;
  durationSec: number;
  width: number;
  size: number;
  range: number;
}

export const SUMMON_BASE: Record<string, SummonBase> = {
  // radius for the clone is taken from the player's live attack range.
  shadowClone:   { damageFactor: 0.5, intervalSec: 5, minIntervalSec: 1.5, radius: 0,    spins: 0, durationSec: 0, width: 0,   size: 0,   range: 0 },
  flyingScythe:  { damageFactor: 0.6, intervalSec: 6, minIntervalSec: 2,   radius: 0.7,  spins: 3, durationSec: 0, width: 0,   size: 0,   range: 1.6 },
  tractorSummon: { damageFactor: 0.6, intervalSec: 7, minIntervalSec: 3,   radius: 0,    spins: 0, durationSec: 0, width: 1.2, size: 0,   range: 0 },
  boomerang:     { damageFactor: 0.6, intervalSec: 6, minIntervalSec: 2,   radius: 0.55, spins: 0, durationSec: 0, width: 0,   size: 0,   range: 2.2 },
  lightning:     { damageFactor: 0.8, intervalSec: 6, minIntervalSec: 2,   radius: 0.8,  spins: 0, durationSec: 0, width: 0,   size: 0,   range: 0 },
  drone:         { damageFactor: 0.5, intervalSec: 8, minIntervalSec: 3,   radius: 0.7,  spins: 0, durationSec: 5, width: 0,   size: 0,   range: 0 },
  tornado:       { damageFactor: 0.6, intervalSec: 9, minIntervalSec: 3,   radius: 0,    spins: 0, durationSec: 4, width: 0,   size: 0.9, range: 0 },
};

/**
 * Obstacles (rocks/trees) are skill-gated and spawn over time. Sizes vary; HP
 * and reward scale with size. Rocks suppress grass growth in an aura around
 * them; trees speed it up.
 */
export const OBSTACLE_TUNING = {
  spawnBaseIntervalSec: 10,
  spawnMinIntervalSec: 3,
  scaleMin: 0.6,
  scaleMax: 1.8,
  // Aura radii are the obstacle's footprint radius times these factors.
  rockNoGrowFactor: 2.4,
  treeBoostFactor: 3.0,
  treeGrowthMultiplier: 2.2,
  // Max simultaneous obstacles per 10x10 of map area.
  maxPer100SqM: 4,
} as const;

/**
 * Map auto-growth: the field widens as the player unlocks more cards. Every
 * `stepSkills` unlocked adds `stepMeters`, clamped to a cap that "Survey"-line
 * cards raise (see CardEffectSystem.getRuntimeStats -> autoMapSizeMeters).
 */
export const MAP_GROWTH = {
  baseMeters: 10,
  stepSkills: 4,
  stepMeters: 2,
  baseCapMeters: 14,
  hardMaxMeters: 60,
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

export function defaultSave(): SaveData {
  return {
    totalGold: 0,
    unlocked: [],
  };
}
