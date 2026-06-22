import {
  BALANCE,
  MAP_GROWTH,
  OBSTACLE_TUNING,
  SUMMON_BASE,
  type RuntimeStats as BaseRuntimeStats,
} from "../config/balance";
import {
  SKILL_NODE_BY_ID,
  SKILL_NODES,
  type SkillEffect,
  type SkillNode,
  type SummonAbilityId,
  type SummonStatKind,
  type ToolId,
  type UnlockGate,
} from "../config/skillTree";

export type { SummonAbilityId, SummonStatKind } from "../config/skillTree";

/** Resolved per-ability stats after folding base values + skill deltas. */
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
import type { EconomyStats } from "./EconomySystem";
import { normalizeSave, type SaveData } from "./SaveSystem";

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
  grassRegrowDelay: number;
  grassRegrowSpeed: number;
  summonDeltas: Record<SummonAbilityId, Record<SummonStatKind, number>>;
  mapExpandCap: number;
  rockSurvey: boolean;
  treeSurvey: boolean;
  obstacleSpawnRate: number;
  obstacleSize: number;
}

function emptySummonDeltas(): Record<SummonAbilityId, Record<SummonStatKind, number>> {
  const out = {} as Record<SummonAbilityId, Record<SummonStatKind, number>>;
  for (const ability of SUMMON_ABILITY_IDS) {
    out[ability] = { count: 0, damage: 0, interval: 0, radius: 0, spins: 0, duration: 0, width: 0, size: 0, range: 0 };
  }
  return out;
}

const DEFAULT_ECONOMY_STATS: EconomyStats = {
  goldDivisor: 4,
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

const TOOL_TO_NODE: Record<Exclude<ToolId, "default">, string> = {
  wide_sickle: "wide_sickle",
  fast_sickle: "fast_sickle",
  bomb_sickle: "bomb_sickle",
  tractor: "tractor_license",
};

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

function isGateSatisfied(save: SaveData, gate: UnlockGate): boolean {
  const normalized = normalizeSave(save);
  switch (gate.kind) {
    case "bestClearPercent":
      return (normalized.lifetimeStats.bestClearPercentByMap[String(gate.mapSize)] ?? 0) >= gate.percent;
    case "lifetimeGrass":
      return normalized.lifetimeStats.grassCut >= gate.count;
    case "bestBombChain":
      return normalized.lifetimeStats.bestBombChain >= gate.length;
  }
}

function areGatesSatisfied(save: SaveData, node: SkillNode): boolean {
  return node.gates.length === 0 || node.gates.some((gate) => isGateSatisfied(save, gate));
}

export function canUnlockNode(save: SaveData, nodeId: string): boolean {
  const normalized = normalizeSave(save);
  const node = SKILL_NODE_BY_ID[nodeId];
  if (!node) {
    return false;
  }
  return (
    isNodeRevealed(normalized, nodeId) &&
    areGatesSatisfied(normalized, node) &&
    !isNodeUnlocked(normalized, nodeId) &&
    normalized.gold >= node.cost
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

export function getNodeCost(nodeId: string): number {
  return SKILL_NODE_BY_ID[nodeId]?.cost ?? Number.POSITIVE_INFINITY;
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

function applyRuntimeEffect(total: RuntimeTotals, effect: SkillEffect): void {
  switch (effect.kind) {
    case "attackDamage":
      total.attackDamage += effect.amount;
      break;
    case "attackRange":
      total.attackRange += effect.amount;
      break;
    case "attackInterval":
      total.attackInterval += effect.amount;
      break;
    case "moveSpeed":
      total.moveSpeed += effect.amount;
      break;
    case "roundDurationPercent":
      total.roundDurationPercent += effect.amount;
      break;
    case "initialGrassCount":
      total.initialGrassCount += effect.amount;
      break;
    case "obstacleDamage":
      total.obstacleDamage += effect.amount;
      break;
    case "failedChopStunPercent":
      total.obstacleStunPercent += effect.amount;
      break;
    case "stumpNoCollision":
      total.stumpNoCollision = true;
      break;
    case "bombCount10m":
      total.bombCount10m += effect.amount;
      break;
    case "bombBlastRadius":
      total.bombBlastRadius += effect.amount;
      break;
    case "bombChainRadius":
      total.bombChainRadius += effect.amount;
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
      total.fireIgniteChance += effect.amount;
      break;
    case "fireDamagePerSecond":
      total.fireDamagePerSecond += effect.amount;
      break;
    case "fireSpreadRadiusMeters":
      total.fireSpreadRadiusMeters += effect.amount;
      break;
    case "fireSpreadChancePerSecond":
      total.fireSpreadChancePerSecond += effect.amount;
      break;
    case "blueGrassSlow":
      total.blueGrassSlow += effect.amount;
      break;
    case "timerGrassBonus":
      total.timerGrassBonus += effect.amount;
      break;
    case "tallGrassGold":
      total.tallGrassGold += effect.amount;
      break;
    case "grassRegrowDelay":
      total.grassRegrowDelay += effect.amount;
      break;
    case "grassGrowSpeed":
      total.grassRegrowSpeed += effect.amount;
      break;
    case "summon":
      total.summonDeltas[effect.ability][effect.stat] += effect.amount;
      break;
    case "mapExpandCap":
      total.mapExpandCap += effect.amount;
      break;
    case "obstacleSurvey":
      total.rockSurvey ||= effect.obstacle === "rock";
      total.treeSurvey ||= effect.obstacle === "tree";
      break;
    case "obstacleSpawnRate":
      total.obstacleSpawnRate += effect.amount;
      break;
    case "obstacleSize":
      total.obstacleSize += effect.amount;
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
  for (const node of SKILL_NODES) {
    if (!isNodeUnlocked(save, node.id)) {
      continue;
    }
    for (const effect of node.effects) {
      applyRuntimeEffect(total, effect);
    }
  }
  return total;
}

export function canSelectTool(save: SaveData, tool: ToolId): boolean {
  if (tool === "default") {
    return true;
  }
  return isNodeUnlocked(save, TOOL_TO_NODE[tool]);
}

export function selectTool(save: SaveData, tool: ToolId): SaveData {
  const normalized = normalizeSave(save);
  if (!canSelectTool(normalized, tool)) {
    return normalized;
  }
  return normalizeSave({ ...normalized, selectedTool: tool });
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

/** Map widens with the number of unlocked skills, capped by Wide-Lands skills. */
function computeAutoMapSize(save: SaveData, capBonus: number): number {
  const unlocked = Object.values(normalizeSave(save).levels).filter((level) => level > 0).length;
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

function applyEconomyEffect(stats: EconomyStats, effect: SkillEffect): void {
  switch (effect.kind) {
    case "goldDivisor":
      stats.goldDivisor += effect.amount;
      break;
    case "cleanPatchScore":
      stats.cleanPatchScore += effect.amount;
      break;
    case "clearBonusPercent":
      stats.clearBonusPercent += effect.amount;
      break;
    case "rockScore":
      stats.rockScore += effect.amount;
      break;
    case "treeScore":
      stats.treeScore += effect.amount;
      break;
    case "obstacleScorePercent":
      stats.obstacleScoreMultiplier += effect.amount / 100;
      break;
    case "bombChainScore":
      stats.bombChainScore += effect.amount;
      break;
    case "firstBombScorePercent":
      stats.firstBombScoreMultiplier += effect.amount / 100;
      break;
    case "grassScorePercent":
      stats.grassScoreMultiplier += effect.amount / 100;
      break;
  }
}

export function getEconomyStats(save: SaveData): EconomyStats {
  const normalized = normalizeSave(save);
  const stats = { ...DEFAULT_ECONOMY_STATS };

  for (const node of SKILL_NODES) {
    if (!isNodeUnlocked(normalized, node.id)) {
      continue;
    }
    for (const effect of node.effects) {
      applyEconomyEffect(stats, effect);
    }
  }

  if (canSelectTool(normalized, "bomb_sickle") && normalized.selectedTool === "bomb_sickle") {
    stats.bombChainScore *= 1.2;
  }

  stats.goldDivisor = Math.max(1, stats.goldDivisor);
  return stats;
}

export function isMapUnlocked(save: SaveData, mapSize: number): boolean {
  return mapSize === 10 || (mapSize === 30 && isNodeUnlocked(save, "open_acre"));
}

export function nextAffordableGoals(save: SaveData, limit = 3): SkillNode[] {
  const normalized = normalizeSave(save);
  return SKILL_NODES
    .filter((node) => canUnlockNode(normalized, node.id))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, limit);
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
