import type { GrassState, VectorXZ } from "../types";

export interface BombState {
  id: string;
  position: VectorXZ;
  detonated: boolean;
}

export function createBombState(id: string, position: VectorXZ): BombState {
  return { id, position, detonated: false };
}

function distance(a: VectorXZ, b: VectorXZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Flood-fill chain detonation. Starting from `triggerId`, detonate it and any
 * not-yet-detonated bomb whose center lies within `chainRadius` of a bomb that
 * already detonated in this chain (transitive: A triggers B, B can then reach
 * C even if C is out of A's range). Pure — does not mutate the input; returns
 * the detonated ids in detonation (BFS) order so the scene can stagger them.
 */
export function resolveChainDetonation(
  bombs: readonly BombState[],
  triggerId: string,
  chainRadius: number,
): string[] {
  const start = bombs.find((bomb) => bomb.id === triggerId);
  if (!start || start.detonated) {
    return [];
  }

  const order: string[] = [];
  const queue: BombState[] = [start];
  const claimed = new Set<string>([start.id]);

  while (queue.length > 0) {
    const current = queue.shift() as BombState;
    order.push(current.id);

    for (const candidate of bombs) {
      if (candidate.detonated || claimed.has(candidate.id)) {
        continue;
      }
      if (distance(candidate.position, current.position) <= chainRadius) {
        claimed.add(candidate.id);
        queue.push(candidate);
      }
    }
  }

  return order;
}

/** Ids of live (not-yet-detonated) bombs within `triggerRadius` of `point`. */
export function bombsTriggeredBy(
  bombs: readonly BombState[],
  point: VectorXZ,
  triggerRadius: number,
): string[] {
  return bombs
    .filter((bomb) => !bomb.detonated && distance(bomb.position, point) <= triggerRadius)
    .map((bomb) => bomb.id);
}

/** Ids of grass whose center lies within `radius` of `center` (the blast area). */
export function grassInRadius(
  grass: readonly GrassState[],
  center: VectorXZ,
  radius: number,
): string[] {
  return grass
    .filter((patch) => distance(patch.position, center) <= radius)
    .map((patch) => patch.id);
}
