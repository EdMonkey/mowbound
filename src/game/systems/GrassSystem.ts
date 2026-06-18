import { BALANCE } from "../config/balance";
import type { GrassState, VectorXZ } from "../types";

export function randomGrassPosition(mapSize = BALANCE.mapSizeMeters, avoid?: VectorXZ): VectorXZ {
  const half = mapSize / 2 - 0.35;
  let position: VectorXZ = { x: 0, z: 0 };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    position = {
      x: Math.random() * mapSize - mapSize / 2,
      z: Math.random() * mapSize - mapSize / 2,
    };

    position.x = Math.max(-half, Math.min(half, position.x));
    position.z = Math.max(-half, Math.min(half, position.z));

    if (!avoid || Math.hypot(position.x - avoid.x, position.z - avoid.z) > 0.75) {
      return position;
    }
  }

  return position;
}

export function createGrassState(id: string, position: VectorXZ, hp = BALANCE.baseGrassHp): GrassState {
  return {
    id,
    position,
    hp,
  };
}

export function createGrassBatch(count: number, startId: number, avoid?: VectorXZ): GrassState[] {
  return Array.from({ length: count }, (_, index) => {
    return createGrassState(`grass-${startId + index}`, randomGrassPosition(BALANCE.mapSizeMeters, avoid));
  });
}
