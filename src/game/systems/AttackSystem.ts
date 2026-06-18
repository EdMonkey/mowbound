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

function normalizeDirection(direction: VectorXZ): VectorXZ {
  const length = Math.hypot(direction.x, direction.z);
  return length === 0 ? { x: 1, z: 0 } : { x: direction.x / length, z: direction.z / length };
}

export function isInAttackArc(
  origin: VectorXZ,
  direction: VectorXZ,
  target: VectorXZ,
  range: number,
  arcDegrees: number,
): boolean {
  const offset = {
    x: target.x - origin.x,
    z: target.z - origin.z,
  };
  const distance = Math.hypot(offset.x, offset.z);

  if (distance > range || distance === 0) {
    return distance === 0;
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
    if (isInAttackArc(request.origin, request.direction, patch.position, request.range, request.arcDegrees)) {
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

export function createAttackArcGeometry(range: number, arcDegrees: number, segments = 32): THREE.BufferGeometry {
  const vertices: number[] = [0, 0, 0];
  const halfArc = THREE.MathUtils.degToRad(arcDegrees / 2);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = -halfArc + t * halfArc * 2;
    vertices.push(Math.cos(angle) * range, 0, Math.sin(angle) * range);
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
