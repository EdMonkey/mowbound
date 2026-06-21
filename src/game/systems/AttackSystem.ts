import * as THREE from "three";
import type { GrassState, VectorXZ } from "../types";

export interface AttackRequest {
  origin: VectorXZ;
  direction: VectorXZ;
  range: number;
  arcDegrees: number;
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

export function isInAttackFan(
  origin: VectorXZ,
  direction: VectorXZ,
  target: VectorXZ,
  range: number,
  arcDegrees: number,
): boolean {
  if (range <= 0 || arcDegrees <= 0) {
    return false;
  }

  const offset = {
    x: target.x - origin.x,
    z: target.z - origin.z,
  };
  const distance = Math.hypot(offset.x, offset.z);

  if (distance > range) {
    return false;
  }

  if (distance === 0) {
    return true;
  }

  const forward = normalizeDirection(direction);
  const targetDirection = {
    x: offset.x / distance,
    z: offset.z / distance,
  };
  const dot = forward.x * targetDirection.x + forward.z * targetDirection.z;
  const halfArcRadians = THREE.MathUtils.degToRad(arcDegrees / 2);

  return dot >= Math.cos(halfArcRadians);
}

export function resolveAttack(request: AttackRequest): AttackResult {
  const hitIds: string[] = [];
  const destroyedIds: string[] = [];
  const nextGrass: GrassState[] = [];

  for (const patch of request.grass) {
    if ((patch.growthRatio ?? 1) < 0.15) {
      nextGrass.push({ ...patch });
      continue;
    }
    if (isInAttackFan(request.origin, request.direction, patch.position, request.range, request.arcDegrees)) {
      hitIds.push(patch.id);

      // 중앙(플레이어)에 가까울수록 강한 데미지, 범위 끝에서는 30%
      const dx = patch.position.x - request.origin.x;
      const dz = patch.position.z - request.origin.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const damageFactor = Math.max(0.3, 1 - (dist / request.range) * 0.7);
      const hp = patch.hp - request.damage * damageFactor;

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

export function getSurvivingHitIds(result: Pick<AttackResult, "hitIds" | "destroyedIds">): string[] {
  const destroyedIds = new Set(result.destroyedIds);

  return result.hitIds.filter((id) => !destroyedIds.has(id));
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

export function createAttackFanGeometry(arcDegrees: number, segments = 32): THREE.BufferGeometry {
  const vertices: number[] = [0, 0, 0];
  const halfArc = THREE.MathUtils.degToRad(arcDegrees / 2);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = -halfArc + t * halfArc * 2;
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
