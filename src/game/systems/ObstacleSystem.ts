import type { VectorXZ } from "../types";
import { isInAttackFan } from "./AttackSystem";

export type ObstacleKind = "rock" | "tree";

export interface ObstacleState {
  id: string;
  kind: ObstacleKind;
  position: VectorXZ;
  hp: number;
  destroyed: boolean;
}

export function createObstacleState(
  id: string,
  kind: ObstacleKind,
  position: VectorXZ,
  hp: number,
): ObstacleState {
  return { id, kind, position, hp, destroyed: false };
}

export interface ObstacleAttackRequest {
  origin: VectorXZ;
  direction: VectorXZ;
  range: number;
  arcDegrees: number;
  damage: number;
  obstacles: readonly ObstacleState[];
}

export interface ObstacleAttackResult {
  /** Obstacles broken this hit (damage strictly greater than their HP). */
  destroyedIds: string[];
  /** Obstacles hit but too tough (damage <= HP): no HP change, all-or-nothing. */
  blockedIds: string[];
  /** The attacker is stunned when a hit fails to break an obstacle (a bad chop). */
  stun: boolean;
}

/**
 * Rocks and trees take damage all-or-nothing: only a hit whose damage is
 * **strictly greater** than the obstacle's HP destroys it (rock -> rubble,
 * tree -> stump). A hit that doesn't exceed the HP does nothing to the obstacle
 * but recoils the attacker into a stun (the caller applies the timer). Reuses
 * the attack fan so obstacles are caught by the same swing as grass.
 */
export function resolveObstacleAttack(request: ObstacleAttackRequest): ObstacleAttackResult {
  const destroyedIds: string[] = [];
  const blockedIds: string[] = [];

  for (const obstacle of request.obstacles) {
    if (obstacle.destroyed) {
      continue;
    }
    if (!isInAttackFan(request.origin, request.direction, obstacle.position, request.range, request.arcDegrees)) {
      continue;
    }
    if (request.damage > obstacle.hp) {
      destroyedIds.push(obstacle.id);
    } else {
      blockedIds.push(obstacle.id);
    }
  }

  return { destroyedIds, blockedIds, stun: blockedIds.length > 0 };
}

export interface Circle {
  x: number;
  z: number;
  radius: number;
}

/** Per-kind collision radius for an intact obstacle (kept under the attack range
 *  + player radius so a pressed-up obstacle still lands inside the swing). */
export const OBSTACLE_COLLISION_RADIUS: Record<ObstacleKind, number> = { rock: 0.3, tree: 0.24 };

/**
 * Push `point` (a mover of `pointRadius`) out of any blocker circle it overlaps,
 * resolving each blocker once. Used so the player can't walk through intact
 * rocks/trees (broken ones are passable and simply aren't passed in as blockers).
 */
export function resolveCollision(point: VectorXZ, blockers: readonly Circle[], pointRadius: number): VectorXZ {
  let { x, z } = point;
  for (const blocker of blockers) {
    const dx = x - blocker.x;
    const dz = z - blocker.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = blocker.radius + pointRadius;
    if (distance >= minDistance) {
      continue;
    }
    if (distance < 1e-4) {
      x = blocker.x + minDistance; // exactly on center: shove out along +x
    } else {
      const push = minDistance - distance;
      x += (dx / distance) * push;
      z += (dz / distance) * push;
    }
  }
  return { x, z };
}
