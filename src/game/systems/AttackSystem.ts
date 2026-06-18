import * as THREE from "three";
import type { GrassState, VectorXZ } from "../types";

export interface AttackRequest {
  origin: VectorXZ;
  direction: VectorXZ;
  range: number;
  zRadius: number;
  damage: number;
  grass: GrassState[];
}

export interface AttackResult {
  grass: GrassState[];
  hitIds: string[];
  destroyedIds: string[];
}

export interface ChargeAttackState {
  elapsedMs: number;
  durationMs: number;
}

export interface ChargeAttackResult {
  state: ChargeAttackState;
  progress: number;
  ready: boolean;
}

function normalizeDirection(direction: VectorXZ): VectorXZ {
  const length = Math.hypot(direction.x, direction.z);
  return length === 0 ? { x: 1, z: 0 } : { x: direction.x / length, z: direction.z / length };
}

export function isInAttackEllipse(
  origin: VectorXZ,
  direction: VectorXZ,
  target: VectorXZ,
  xRadius: number,
  zRadius: number,
): boolean {
  if (xRadius <= 0 || zRadius <= 0) {
    return false;
  }

  const offset = {
    x: target.x - origin.x,
    z: target.z - origin.z,
  };
  const forward = normalizeDirection(direction);
  const right = {
    x: -forward.z,
    z: forward.x,
  };
  const localX = offset.x * forward.x + offset.z * forward.z;
  const localZ = offset.x * right.x + offset.z * right.z;

  return (localX * localX) / (xRadius * xRadius) + (localZ * localZ) / (zRadius * zRadius) <= 1;
}

export function resolveAttack(request: AttackRequest): AttackResult {
  const hitIds: string[] = [];
  const destroyedIds: string[] = [];
  const nextGrass: GrassState[] = [];

  for (const patch of request.grass) {
    if (isInAttackEllipse(request.origin, request.direction, patch.position, request.range, request.zRadius)) {
      hitIds.push(patch.id);
      const hp = patch.hp - request.damage;

      if (hp <= 0) {
        destroyedIds.push(patch.id);
        continue;
      }

      nextGrass.push({ ...patch, hp });
      continue;
    }

    nextGrass.push({ ...patch });
  }

  return {
    grass: nextGrass,
    hitIds,
    destroyedIds,
  };
}

export function advanceChargeAttack(state: ChargeAttackState, deltaMs: number): ChargeAttackResult {
  const durationMs = Math.max(1, state.durationMs);
  const elapsedMs = Math.max(0, state.elapsedMs + deltaMs);
  const ready = elapsedMs >= durationMs;
  const progress = ready ? 1 : THREE.MathUtils.clamp(elapsedMs / durationMs, 0, 1);

  return {
    ready,
    progress,
    state: {
      durationMs,
      elapsedMs: ready ? elapsedMs - durationMs : elapsedMs,
    },
  };
}

export function createAttackEllipseGeometry(segments = 64): THREE.BufferGeometry {
  const vertices: number[] = [0, 0, 0];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = t * Math.PI * 2;
    vertices.push(Math.cos(angle), 0, Math.sin(angle));
  }

  const indices: number[] = [];
  for (let index = 1; index <= segments; index += 1) {
    indices.push(0, index, index + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
