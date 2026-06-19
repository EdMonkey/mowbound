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

/**
 * Even, spread-out placement via a jittered grid: one clump per cell at the
 * cell centre plus a small random offset. Covers the map edge-to-edge without
 * the clumps-and-gaps look of independent uniform random scatter. Cells within
 * the avoid radius (the player) are skipped.
 */
export function createGrassBatch(
  count: number,
  startId: number,
  avoid?: VectorXZ,
  mapSize = BALANCE.mapSizeMeters,
): GrassState[] {
  const usable = mapSize - 0.7;
  const cells = Math.max(1, Math.ceil(Math.sqrt(count)));
  const cell = usable / cells;
  const jitter = cell * 0.45;
  const half = usable / 2;

  const states: GrassState[] = [];
  let id = startId;

  for (let row = 0; row < cells && states.length < count; row += 1) {
    for (let col = 0; col < cells && states.length < count; col += 1) {
      const x = -half + (col + 0.5) * cell + (Math.random() * 2 - 1) * jitter;
      const z = -half + (row + 0.5) * cell + (Math.random() * 2 - 1) * jitter;

      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 0.8) {
        continue;
      }

      states.push(createGrassState(`grass-${id}`, { x, z }));
      id += 1;
    }
  }

  return states;
}
