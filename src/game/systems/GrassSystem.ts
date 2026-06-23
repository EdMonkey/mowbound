import { BALANCE } from "../config/balance";
import type { GrassKind, GrassState, VectorXZ } from "../types";

export interface GrassExclusionCircle {
  x: number;
  z: number;
  radius: number;
}

export interface GrassBatchOptions {
  blueRate?: number;
  tallRate?: number;
}

function isOutsideExclusions(position: VectorXZ, exclusions: readonly GrassExclusionCircle[]): boolean {
  return exclusions.every((circle) => Math.hypot(position.x - circle.x, position.z - circle.z) > circle.radius);
}

function isAllowedGrassPosition(
  position: VectorXZ,
  avoid: VectorXZ | undefined,
  exclusions: readonly GrassExclusionCircle[],
): boolean {
  const farEnoughFromAvoid = !avoid || Math.hypot(position.x - avoid.x, position.z - avoid.z) > 0.75;
  return farEnoughFromAvoid && isOutsideExclusions(position, exclusions);
}

export function randomGrassPosition(
  mapSize: number = BALANCE.mapSizeMeters,
  avoid?: VectorXZ,
  exclusions: readonly GrassExclusionCircle[] = [],
): VectorXZ {
  const half = mapSize / 2 - 0.35;
  let position: VectorXZ = { x: 0, z: 0 };

  for (let attempt = 0; attempt < 64; attempt += 1) {
    position = {
      x: Math.random() * mapSize - mapSize / 2,
      z: Math.random() * mapSize - mapSize / 2,
    };

    position.x = Math.max(-half, Math.min(half, position.x));
    position.z = Math.max(-half, Math.min(half, position.z));

    if (isAllowedGrassPosition(position, avoid, exclusions)) {
      return position;
    }
  }

  const cells = 12;
  const step = (half * 2) / (cells - 1);
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      position = { x: -half + col * step, z: -half + row * step };
      if (isAllowedGrassPosition(position, avoid, exclusions)) {
        return position;
      }
    }
  }

  return position;
}

function hpForKind(kind: GrassKind): number {
  const base = BALANCE.baseGrassHp;
  if (kind === "tall") return base * BALANCE.tallGrassHpMultiplier;
  return base;
}

export function createGrassState(
  id: string,
  position: VectorXZ,
  kind: GrassKind = "normal",
  growthRatio = 1,
  regrowDelay = 0,
): GrassState {
  return {
    id,
    position,
    hp: hpForKind(kind) * growthRatio,
    kind,
    growthRatio,
    regrowDelay,
  };
}

const GRASS_BOUNDARY_MARGIN = 0.1; // no grass within 10cm of the map edge
const GRASS_JITTER = 0.1; // +/-10cm random offset per grid point

function clampSpawnRate(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function chooseGrassKind(options: GrassBatchOptions): GrassKind {
  const blueRate = clampSpawnRate(options.blueRate);
  const tallRate = Math.min(1 - blueRate, clampSpawnRate(options.tallRate));
  const roll = Math.random();

  if (roll < blueRate) {
    return "blue";
  }
  if (roll < blueRate + tallRate) {
    return "tall";
  }
  return "normal";
}

/**
 * Grid placement: a square grid of `round(sqrt(count))` nodes per side (e.g.
 * 1600 -> 40x40), each offset by a random +/-10cm, kept at least 10cm inside
 * the map boundary.
 */
export function createGrassBatch(
  count: number,
  startId: number,
  mapSize: number = BALANCE.mapSizeMeters,
  exclusions: readonly GrassExclusionCircle[] = [],
  options: GrassBatchOptions = {},
): GrassState[] {
  const cells = Math.max(1, Math.round(Math.sqrt(count)));
  const limit = mapSize / 2 - GRASS_BOUNDARY_MARGIN - GRASS_JITTER;
  const step = cells > 1 ? (2 * limit) / (cells - 1) : 0;

  const states: GrassState[] = [];
  let id = startId;

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const position = {
        x: -limit + col * step + (Math.random() * 2 - 1) * GRASS_JITTER,
        z: -limit + row * step + (Math.random() * 2 - 1) * GRASS_JITTER,
      };
      if (!isOutsideExclusions(position, exclusions)) {
        continue;
      }
      states.push(createGrassState(`grass-${id}`, position, chooseGrassKind(options)));
      id += 1;
    }
  }

  return states;
}
