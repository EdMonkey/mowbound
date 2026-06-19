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
  /** The attacker is stunned whenever an obstacle is broken this hit. */
  stun: boolean;
}

/**
 * Rocks and trees take damage all-or-nothing: only a hit whose damage is
 * **strictly greater** than the obstacle's HP destroys it (rock -> rubble,
 * tree -> stump). A hit that doesn't exceed the HP does nothing — no chipping.
 * Breaking at least one obstacle stuns the attacker (caller applies the timer).
 * Reuses the attack fan so obstacles are caught by the same swing as grass.
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

  return { destroyedIds, blockedIds, stun: destroyedIds.length > 0 };
}
