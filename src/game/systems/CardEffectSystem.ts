import {
  BALANCE,
  MAP_GROWTH,
  OBSTACLE_TUNING,
  SUMMON_BASE,
  type RuntimeStats as BaseRuntimeStats,
} from "../config/balance";
import { CARDS, type CardEffect } from "../config/cards";
import type { ToolId } from "../config/tools";
import type { EconomyStats } from "./EconomySystem";
import { canSelectTool, isCardUnlocked } from "./CardProgressionSystem";
import { normalizeSave, type SaveData } from "./SaveSystem";

export type SummonAbilityId =
  | "shadowClone"
  | "flyingScythe"
  | "tractorSummon"
  | "boomerang"
  | "lightning"
  | "drone"
  | "tornado";

export type SummonStatKind =
  | "count"
  | "damage"
  | "interval"
  | "radius"
  | "spins"
  | "duration"
  | "width"
  | "size"
  | "range";

/** Resolved per-ability stats after folding base values + card deltas. */
export interface SummonRuntime {
  count: number;
  damageFactor: number;
  intervalSec: number;
  radius: number;
  spins: number;
  durationSec: number;
  width: number;
  size: number;
  range: number;
}

const SUMMON_ABILITY_IDS: SummonAbilityId[] = [
  "shadowClone",
  "flyingScythe",
  "tractorSummon",
  "boomerang",
  "lightning",
  "drone",
  "tornado",
];

const SUMMON_STAT_KINDS: SummonStatKind[] = [
  "count",
  "damage",
  "interval",
  "radius",
  "spins",
  "duration",
  "width",
  "size",
  "range",
];

export interface RuntimeStats extends BaseRuntimeStats {
  fireIgniteChance: number;
  fireDamagePerSecond: number;
  fireSpreadRadiusMeters: number;
  fireSpreadChancePerSecond: number;
  obstacleDamageBonus: number;
  obstacleStunMultiplier: number;
  stumpNoCollision: boolean;
  bombCount10m: number;
  bombBlastRadiusMeters: number;
  bombChainRadiusMeters: number;
  bombChainScoreMultiplier: number;
  selectedTool: ToolId;
  hasCycloneCut: boolean;
  hasSprintHarvest: boolean;
  hasGoldenField: boolean;
  hasClearcut: boolean;
  hasAlienCropMark: boolean;
  hasMowerLaser: boolean;
  hasTractor: boolean;
  blueGrassSlow: number;
  timerGrassBonus: number;
  tallGrassGold: number;
  blueGrassRate: number;
  tallGrassRate: number;
  timerGrassCount: number;
  grassRegrowDelay: number;
  grassRegrowSpeed: number;
  summons: Record<SummonAbilityId, SummonRuntime>;
  mapExpandCapBonus: number;
  autoMapSizeMeters: number;
  rockEnabled: boolean;
  treeEnabled: boolean;
  obstacleSpawnIntervalSec: number;
  obstacleSizeBonus: number;
}

export interface CuttablePoint {
  id: string;
  x: number;
  z: number;
  alive: boolean;
}

export interface BombPoint {
  id: string;
  x: number;
  z: number;
  triggered: boolean;
}

export interface LaserHitRequest {
  origin: { x: number; z: number };
  direction: { x: number; z: number };
  length: number;
  width: number;
  grass: CuttablePoint[];
  bombs: BombPoint[];
}

export interface StripHitRequest {
  origin: { x: number; z: number };
  direction: { x: number; z: number };
  length: number;
  width: number;
  grass: CuttablePoint[];
}

interface RuntimeTotals {
  attackDamage: number;
  attackRange: number;
  attackInterval: number;
  moveSpeed: number;
  roundDurationPercent: number;
  initialGrassCount: number;
  obstacleDamage: number;
  obstacleStunPercent: number;
  stumpNoCollision: boolean;
  bombCount10m: number;
  bombBlastRadius: number;
  bombChainRadius: number;
  bombChainScoreMultiplier: number;
  hasCycloneCut: boolean;
  hasSprintHarvest: boolean;
  hasGoldenField: boolean;
  hasClearcut: boolean;
  hasAlienCropMark: boolean;
  hasMowerLaser: boolean;
  fireIgniteChance: number;
  fireDamagePerSecond: number;
  fireSpreadRadiusMeters: number;
  fireSpreadChancePerSecond: number;
  blueGrassSlow: number;
  timerGrassBonus: number;
  tallGrassGold: number;
  blueGrassUnlocked: boolean;
  timerGrassUnlocked: boolean;
  tallGrassUnlocked: boolean;
  grassRegrowDelay: number;
  grassRegrowSpeed: number;
  summonDeltas: Record<SummonAbilityId, Record<SummonStatKind, number>>;
  mapExpandCap: number;
  rockSurvey: boolean;
  treeSurvey: boolean;
  obstacleSpawnRate: number;
  obstacleSize: number;
}

const DEFAULT_ECONOMY_STATS: EconomyStats = {
  goldDivisor: 2,
  goldMultiplier: 1,
  grassScoreMultiplier: 1,
  cleanPatchScore: 0,
  clearBonusPercent: 0,
  rockScore: 0,
  treeScore: 0,
  bombChainScore: 0,
  firstBombScoreMultiplier: 1,
  obstacleScoreMultiplier: 1,
  largeMapBonusCap: 1,
};

function amount(effect: CardEffect): number {
  return Number.isFinite(effect.amount) ? effect.amount! : 0;
}

function isSummonAbilityId(value: unknown): value is SummonAbilityId {
  return typeof value === "string" && (SUMMON_ABILITY_IDS as string[]).includes(value);
}

function isSummonStatKind(value: unknown): value is SummonStatKind {
  return typeof value === "string" && (SUMMON_STAT_KINDS as string[]).includes(value);
}

function emptySummonDeltas(): Record<SummonAbilityId, Record<SummonStatKind, number>> {
  const out = {} as Record<SummonAbilityId, Record<SummonStatKind, number>>;
  for (const ability of SUMMON_ABILITY_IDS) {
    out[ability] = { count: 0, damage: 0, interval: 0, radius: 0, spins: 0, duration: 0, width: 0, size: 0, range: 0 };
  }
  return out;
}

function newRuntimeTotals(): RuntimeTotals {
  return {
    attackDamage: 0,
    attackRange: 0,
    attackInterval: 0,
    moveSpeed: 0,
    roundDurationPercent: 0,
    initialGrassCount: 0,
    obstacleDamage: 0,
    obstacleStunPercent: 0,
    stumpNoCollision: false,
    bombCount10m: 0,
    bombBlastRadius: 0,
    bombChainRadius: 0,
    bombChainScoreMultiplier: 1,
    hasCycloneCut: false,
    hasSprintHarvest: false,
    hasGoldenField: false,
    hasClearcut: false,
    hasAlienCropMark: false,
    hasMowerLaser: false,
    fireIgniteChance: 0,
    fireDamagePerSecond: 0,
    fireSpreadRadiusMeters: 0,
    fireSpreadChancePerSecond: 0,
    blueGrassSlow: 0,
    timerGrassBonus: 0,
    tallGrassGold: 0,
    blueGrassUnlocked: false,
    timerGrassUnlocked: false,
    tallGrassUnlocked: false,
    grassRegrowDelay: 0,
    grassRegrowSpeed: 0,
    summonDeltas: emptySummonDeltas(),
    mapExpandCap: 0,
    rockSurvey: false,
    treeSurvey: false,
    obstacleSpawnRate: 0,
    obstacleSize: 0,
  };
}

function applyRuntimeEffect(total: RuntimeTotals, effect: CardEffect): void {
  switch (effect.kind) {
    case "attackDamage":
      total.attackDamage += amount(effect);
      break;
    case "attackRange":
      total.attackRange += amount(effect);
      break;
    case "attackInterval":
      total.attackInterval += amount(effect);
      break;
    case "moveSpeed":
      total.moveSpeed += amount(effect);
      break;
    case "roundDurationPercent":
      total.roundDurationPercent += amount(effect);
      break;
    case "initialGrassCount":
      total.initialGrassCount += amount(effect);
      break;
    case "obstacleDamage":
      total.obstacleDamage += amount(effect);
      break;
    case "failedChopStunPercent":
      total.obstacleStunPercent += amount(effect);
      break;
    case "stumpNoCollision":
      total.stumpNoCollision = true;
      break;
    case "bombCount10m":
      total.bombCount10m += amount(effect);
      break;
    case "bombBlastRadius":
      total.bombBlastRadius += amount(effect);
      break;
    case "bombChainRadius":
      total.bombChainRadius += amount(effect);
      break;
    case "special":
      total.hasCycloneCut ||= effect.id === "cyclone_cut";
      total.hasSprintHarvest ||= effect.id === "sprint_harvest";
      total.hasGoldenField ||= effect.id === "golden_field";
      total.hasClearcut ||= effect.id === "clearcut";
      total.hasAlienCropMark ||= effect.id === "alien_crop_mark";
      total.hasMowerLaser ||= effect.id === "mower_laser";
      break;
    case "fireIgniteChance":
      total.fireIgniteChance += amount(effect);
      break;
    case "fireDamagePerSecond":
      total.fireDamagePerSecond += amount(effect);
      break;
    case "fireSpreadRadiusMeters":
      total.fireSpreadRadiusMeters += amount(effect);
      break;
    case "fireSpreadChancePerSecond":
      total.fireSpreadChancePerSecond += amount(effect);
      break;
    case "blueGrassSlow":
      total.blueGrassUnlocked = true;
      total.blueGrassSlow += amount(effect);
      break;
    case "timerGrassBonus":
      total.timerGrassUnlocked = true;
      total.timerGrassBonus += amount(effect);
      break;
    case "tallGrassGold":
      total.tallGrassUnlocked = true;
      total.tallGrassGold += amount(effect);
      break;
    case "grassRegrowDelay":
      total.grassRegrowDelay += amount(effect);
      break;
    case "grassGrowSpeed":
      total.grassRegrowSpeed += amount(effect);
      break;
    case "summon":
      if (isSummonAbilityId(effect.ability) && isSummonStatKind(effect.stat)) {
        total.summonDeltas[effect.ability][effect.stat] += amount(effect);
      }
      break;
    case "mapExpandCap":
      total.mapExpandCap += amount(effect);
      break;
    case "obstacleSurvey":
      total.rockSurvey ||= effect.obstacle === "rock";
      total.treeSurvey ||= effect.obstacle === "tree";
      break;
    case "obstacleSpawnRate":
      total.obstacleSpawnRate += amount(effect);
      break;
    case "obstacleSize":
      total.obstacleSize += amount(effect);
      break;
    case "toolUnlock":
    case "unlockMap":
    case "goldDivisor":
    case "cleanPatchScore":
    case "clearBonusPercent":
    case "rockScore":
    case "treeScore":
    case "obstacleBreakGrassBonus":
    case "obstacleScorePercent":
    case "bombChainScore":
    case "firstBombScorePercent":
    case "grassScorePercent":
      break;
  }
}

function runtimeTotals(save: SaveData): RuntimeTotals {
  const total = newRuntimeTotals();
  for (const card of CARDS) {
    if (!isCardUnlocked(save, card.id)) {
      continue;
    }
    for (const effect of card.effects) {
      applyRuntimeEffect(total, effect);
    }
  }
  return total;
}

export function getRuntimeStats(save: SaveData): RuntimeStats {
  const normalized = normalizeSave(save);
  const total = runtimeTotals(normalized);
  const selectedTool = canSelectTool(normalized, normalized.selectedTool) ? normalized.selectedTool : "default";

  if (selectedTool === "wide_sickle") {
    total.attackRange += 0.25;
    total.attackInterval += 150;
  } else if (selectedTool === "fast_sickle") {
    total.attackRange -= 0.05;
    total.attackInterval -= 150;
  } else if (selectedTool === "bomb_sickle") {
    total.bombCount10m += 2;
    total.bombChainScoreMultiplier += 0.2;
  }

  const attackIntervalMs = Math.max(
    BALANCE.minAttackIntervalMs,
    BALANCE.baseAttackIntervalMs + total.attackInterval,
  );
  const roundDurationMs = Math.round(BALANCE.roundDurationMs * (1 + total.roundDurationPercent / 100));

  return {
    attackDamage: BALANCE.baseAttackDamage + total.attackDamage,
    attackRangeMeters: BALANCE.baseAttackRangeMeters + total.attackRange,
    attackArcDegrees: BALANCE.baseAttackArcDegrees,
    attackChargeDurationMs: attackIntervalMs,
    attackIntervalMs,
    moveSpeed: BALANCE.playerMoveSpeed + total.moveSpeed,
    goldPerGrass: BALANCE.baseGoldPerGrass,
    initialGrassCount: BALANCE.initialGrassCount + total.initialGrassCount,
    grassSpawnIntervalMs: BALANCE.grassSpawnIntervalMs,
    grassSpawnPerTick: BALANCE.grassSpawnPerTick,
    roundDurationMs,
    obstacleDamageBonus: total.obstacleDamage,
    obstacleStunMultiplier: Math.max(0, 1 + total.obstacleStunPercent / 100),
    stumpNoCollision: total.stumpNoCollision,
    bombCount10m: total.bombCount10m,
    bombBlastRadiusMeters: BALANCE.bombBlastRadiusMeters + total.bombBlastRadius,
    bombChainRadiusMeters: BALANCE.bombChainRadiusMeters + total.bombChainRadius,
    bombChainScoreMultiplier: total.bombChainScoreMultiplier,
    selectedTool,
    hasCycloneCut: total.hasCycloneCut,
    hasSprintHarvest: total.hasSprintHarvest,
    hasGoldenField: total.hasGoldenField,
    hasClearcut: total.hasClearcut,
    hasAlienCropMark: total.hasAlienCropMark,
    hasMowerLaser: total.hasMowerLaser,
    hasTractor: selectedTool === "tractor",
    fireIgniteChance: total.fireIgniteChance,
    fireDamagePerSecond: BALANCE.fireDamagePerSecond + total.fireDamagePerSecond,
    fireSpreadRadiusMeters: BALANCE.fireSpreadRadiusMeters + total.fireSpreadRadiusMeters,
    fireSpreadChancePerSecond: BALANCE.fireSpreadChancePerSecond + total.fireSpreadChancePerSecond,
    blueGrassSlow: total.blueGrassSlow,
    timerGrassBonus: total.timerGrassBonus,
    tallGrassGold: total.tallGrassGold,
    blueGrassRate: total.blueGrassUnlocked ? BALANCE.blueGrassSpawnRate : 0,
    tallGrassRate: total.tallGrassUnlocked ? BALANCE.tallGrassSpawnRate : 0,
    timerGrassCount: total.timerGrassUnlocked ? BALANCE.timerGrassCount : 0,
    grassRegrowDelay: total.grassRegrowDelay,
    grassRegrowSpeed: total.grassRegrowSpeed,
    summons: foldSummons(total.summonDeltas),
    mapExpandCapBonus: total.mapExpandCap,
    autoMapSizeMeters: computeAutoMapSize(normalized, total.mapExpandCap),
    rockEnabled: total.rockSurvey,
    treeEnabled: total.treeSurvey,
    obstacleSpawnIntervalSec: Math.max(
      OBSTACLE_TUNING.spawnMinIntervalSec,
      OBSTACLE_TUNING.spawnBaseIntervalSec + total.obstacleSpawnRate,
    ),
    obstacleSizeBonus: total.obstacleSize,
  };
}

function computeAutoMapSize(save: SaveData, capBonus: number): number {
  const unlocked = Object.values(normalizeSave(save).unlockedCards).filter((level) => level > 0).length;
  const grown = MAP_GROWTH.baseMeters + Math.floor(unlocked / MAP_GROWTH.stepSkills) * MAP_GROWTH.stepMeters;
  const cap = Math.min(MAP_GROWTH.hardMaxMeters, MAP_GROWTH.baseCapMeters + capBonus);
  return Math.max(MAP_GROWTH.baseMeters, Math.min(grown, cap));
}

function foldSummons(
  deltas: Record<SummonAbilityId, Record<SummonStatKind, number>>,
): Record<SummonAbilityId, SummonRuntime> {
  const out = {} as Record<SummonAbilityId, SummonRuntime>;
  for (const ability of SUMMON_ABILITY_IDS) {
    const base = SUMMON_BASE[ability];
    const d = deltas[ability];
    const count = Math.max(0, Math.round(d.count));
    out[ability] = {
      count,
      damageFactor: count > 0 ? base.damageFactor + d.damage : 0,
      intervalSec: Math.max(base.minIntervalSec, base.intervalSec + d.interval),
      radius: base.radius + d.radius,
      spins: base.spins + d.spins,
      durationSec: base.durationSec + d.duration,
      width: base.width + d.width,
      size: base.size + d.size,
      range: base.range + d.range,
    };
  }
  return out;
}

function applyEconomyEffect(stats: EconomyStats, effect: CardEffect): void {
  switch (effect.kind) {
    case "goldDivisor":
      stats.goldDivisor += amount(effect);
      break;
    case "cleanPatchScore":
      stats.cleanPatchScore += amount(effect);
      break;
    case "clearBonusPercent":
      stats.clearBonusPercent += amount(effect);
      break;
    case "rockScore":
      stats.rockScore += amount(effect);
      break;
    case "treeScore":
      stats.treeScore += amount(effect);
      break;
    case "obstacleScorePercent":
      stats.obstacleScoreMultiplier += amount(effect) / 100;
      break;
    case "bombChainScore":
      stats.bombChainScore += amount(effect);
      break;
    case "firstBombScorePercent":
      stats.firstBombScoreMultiplier += amount(effect) / 100;
      break;
    case "grassScorePercent":
      stats.grassScoreMultiplier += amount(effect) / 100;
      break;
  }
}

export function getEconomyStats(save: SaveData): EconomyStats {
  const normalized = normalizeSave(save);
  const stats = { ...DEFAULT_ECONOMY_STATS };

  for (const card of CARDS) {
    if (!isCardUnlocked(normalized, card.id)) {
      continue;
    }
    for (const effect of card.effects) {
      applyEconomyEffect(stats, effect);
    }
  }

  if (canSelectTool(normalized, "bomb_sickle") && normalized.selectedTool === "bomb_sickle") {
    stats.bombChainScore *= 1.2;
  }

  stats.goldDivisor = Math.max(1, stats.goldDivisor);
  return stats;
}

function normalize2(v: { x: number; z: number }): { x: number; z: number } {
  const length = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / length, z: v.z / length };
}

function isInForwardStrip(
  point: { x: number; z: number },
  origin: { x: number; z: number },
  direction: { x: number; z: number },
  length: number,
  width: number,
): boolean {
  const dir = normalize2(direction);
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const forward = dx * dir.x + dz * dir.z;
  const side = Math.abs(dx * -dir.z + dz * dir.x);
  return forward >= 0 && forward <= length && side <= width / 2;
}

export function computeCropMarkHits(
  grass: CuttablePoint[],
  center: { x: number; z: number },
  radius: number,
): string[] {
  const radiusSq = radius * radius;
  return grass
    .filter((item) => item.alive && (item.x - center.x) ** 2 + (item.z - center.z) ** 2 <= radiusSq)
    .map((item) => item.id);
}

export function computeLaserHits(request: LaserHitRequest): { grassIds: string[]; bombIds: string[] } {
  return {
    grassIds: request.grass
      .filter((item) => item.alive && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
      .map((item) => item.id),
    bombIds: request.bombs
      .filter((item) => !item.triggered && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
      .map((item) => item.id),
  };
}

export function computeTractorStripHits(request: StripHitRequest): string[] {
  return request.grass
    .filter((item) => item.alive && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
    .map((item) => item.id);
}
