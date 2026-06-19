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

const GRASS_BOUNDARY_MARGIN = 0.1; // no grass within 10cm of the map edge
const GRASS_JITTER = 0.1; // ±10cm random offset per grid point

/**
 * Grid placement: a square grid of `round(sqrt(count))` nodes per side (e.g.
 * 1600 -> 40x40), each offset by a random ±10cm, kept at least 10cm inside the
 * map boundary.
 */
export function createGrassBatch(
  count: number,
  startId: number,
  mapSize = BALANCE.mapSizeMeters,
): GrassState[] {
  const cells = Math.max(1, Math.round(Math.sqrt(count)));
  // Nodes span [-limit, limit] so node + jitter stays inside (half - margin).
  const limit = mapSize / 2 - GRASS_BOUNDARY_MARGIN - GRASS_JITTER;
  const step = cells > 1 ? (2 * limit) / (cells - 1) : 0;

  const states: GrassState[] = [];
  let id = startId;

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const x = -limit + col * step + (Math.random() * 2 - 1) * GRASS_JITTER;
      const z = -limit + row * step + (Math.random() * 2 - 1) * GRASS_JITTER;
      states.push(createGrassState(`grass-${id}`, { x, z }));
      id += 1;
    }
  }

  return states;
}
