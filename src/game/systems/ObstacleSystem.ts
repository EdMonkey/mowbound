import type { VectorXZ } from "../types";
import { isInAttackFan } from "./AttackSystem";

export type ObstacleKind = "rock" | "tree";

export interface ObstacleState {
  id: string;
  kind: ObstacleKind;
  position: VectorXZ;
  hp: number;
  /** Ground-footprint radius (base radius * the instance's visual scale). */
  radius: number;
  destroyed: boolean;
}

export function createObstacleState(
  id: string,
  kind: ObstacleKind,
  position: VectorXZ,
  hp: number,
  radius: number,
): ObstacleState {
  return { id, kind, position, hp, radius, destroyed: false };
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
 * the attack fan, but extends the reach by each obstacle's radius so the swing
 * lands when it touches the obstacle's edge (not only its center) — this keeps
 * even a large rock reachable regardless of its collision circle.
 */
export function resolveObstacleAttack(request: ObstacleAttackRequest): ObstacleAttackResult {
  const destroyedIds: string[] = [];
  const blockedIds: string[] = [];

  for (const obstacle of request.obstacles) {
    if (obstacle.destroyed) {
      continue;
    }
    const reach = request.range + obstacle.radius;
    if (!isInAttackFan(request.origin, request.direction, obstacle.position, reach, request.arcDegrees)) {
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

/**
 * Per-kind base collision radius matching the model's ground footprint at scale
 * 1 (rock mesh half-width ~0.33; tree trunk ~0.24). The spawner multiplies this
 * by the instance's visual scale so the circle tracks the actual mesh size.
 */
export const OBSTACLE_BASE_RADIUS: Record<ObstacleKind, number> = { rock: 0.33, tree: 0.24 };

/** Collision radius of a tree's leftover stump (the stump keeps blocking). */
export const TREE_STUMP_BASE_RADIUS = 0.17;

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
