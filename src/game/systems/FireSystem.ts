import { BALANCE } from "../config/balance";
import type { GrassState, VectorXZ } from "../types";

export interface FireTickResult {
  grass: GrassState[];
  damagedIds: string[];
  destroyedIds: string[];
  ignitedIds: string[];
}

export interface FireStats {
  damagePerSecond: number;
  spreadRadiusMeters: number;
  spreadChancePerSecond: number;
  spreadDurationMultiplier?: number;
  spreadMinDurationSeconds?: number;
}

function distance(a: VectorXZ, b: VectorXZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function tryIgniteGrass(
  grass: readonly GrassState[],
  candidateIds: readonly string[],
  chance: number,
  random: () => number = Math.random,
): string[] {
  if (chance <= 0) {
    return [];
  }

  const alive = new Set(grass.map((patch) => patch.id));
  const ignited: string[] = [];

  for (const id of candidateIds) {
    if (alive.has(id) && random() < chance) {
      ignited.push(id);
    }
  }

  return ignited;
}

export function igniteGrassAround(
  grass: readonly GrassState[],
  centers: readonly VectorXZ[],
  radius: number,
  chance: number,
  random: () => number = Math.random,
): string[] {
  if (centers.length === 0 || radius <= 0 || chance <= 0) {
    return [];
  }

  const ignited: string[] = [];

  for (const patch of grass) {
    if (patch.hp <= 0 || (patch.burningSeconds ?? 0) > 0 || (patch.growthRatio ?? 1) < 0.5) {
      continue;
    }
    const inRange = centers.some((center) => distance(center, patch.position) <= radius);
    if (inRange && random() < chance) {
      ignited.push(patch.id);
    }
  }

  return ignited;
}

export function tickFire(
  grass: readonly GrassState[],
  deltaSeconds: number,
  statsOrRandom: FireStats | (() => number) = {
    damagePerSecond: BALANCE.fireDamagePerSecond,
    spreadRadiusMeters: BALANCE.fireSpreadRadiusMeters,
    spreadChancePerSecond: BALANCE.fireSpreadChancePerSecond,
  },
  random: () => number = Math.random,
): FireTickResult {
  const stats = typeof statsOrRandom === "function"
    ? {
      damagePerSecond: BALANCE.fireDamagePerSecond,
      spreadRadiusMeters: BALANCE.fireSpreadRadiusMeters,
      spreadChancePerSecond: BALANCE.fireSpreadChancePerSecond,
    }
    : statsOrRandom;
  const roll = typeof statsOrRandom === "function" ? statsOrRandom : random;

  const spreadDurationMultiplier = stats.spreadDurationMultiplier ?? 1;
  const spreadMinDuration = stats.spreadMinDurationSeconds ?? 0;

  if (deltaSeconds <= 0) {
    return { grass: grass.map((patch) => ({ ...patch })), damagedIds: [], destroyedIds: [], ignitedIds: [] };
  }

  const burning = grass.filter((patch) => (patch.burningSeconds ?? 0) > 0 && patch.hp > 0);

  // id → how many seconds the child patch will burn (generation-decayed)
  const ignitedMap = new Map<string, number>();

  for (const source of burning) {
    const sourceDuration = source.burningSeconds!;
    const childDuration = sourceDuration * spreadDurationMultiplier;

    if (childDuration < spreadMinDuration) {
      continue;
    }

    for (const target of grass) {
      if (
        target.id === source.id ||
        target.hp <= 0 ||
        (target.burningSeconds ?? 0) > 0 ||
        ignitedMap.has(target.id) ||
        (target.growthRatio ?? 1) < 0.5
      ) {
        continue;
      }
      if (
        distance(source.position, target.position) <= stats.spreadRadiusMeters &&
        roll() < stats.spreadChancePerSecond * deltaSeconds
      ) {
        ignitedMap.set(target.id, childDuration);
      }
    }
  }

  const damagedIds: string[] = [];
  const destroyedIds: string[] = [];
  const nextGrass: GrassState[] = [];

  for (const patch of grass) {
    const wasBurning = (patch.burningSeconds ?? 0) > 0;
    const isNewlyIgnited = ignitedMap.has(patch.id);

    if (!wasBurning && !isNewlyIgnited) {
      nextGrass.push({ ...patch });
      continue;
    }

    const initialSeconds = wasBurning
      ? patch.burningSeconds!
      : ignitedMap.get(patch.id)!;
    const burningSeconds = Math.max(0, initialSeconds - deltaSeconds);

    const hp = patch.hp - stats.damagePerSecond * deltaSeconds;
    damagedIds.push(patch.id);

    if (hp <= 0) {
      destroyedIds.push(patch.id);
      continue;
    }

    nextGrass.push({
      ...patch,
      hp,
      ...(burningSeconds > 0 ? { burningSeconds } : {}),
    });
  }

  return {
    grass: nextGrass,
    damagedIds,
    destroyedIds,
    ignitedIds: [...ignitedMap.keys()],
  };
}
