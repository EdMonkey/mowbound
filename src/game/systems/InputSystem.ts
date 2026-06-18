import type { VectorXZ } from "../types";

const KEY_VECTORS: Record<string, VectorXZ> = {
  KeyW: { x: 0, z: -1 },
  ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

export function normalizeInputVector(vector: VectorXZ, deadZone = 0): VectorXZ {
  const length = Math.hypot(vector.x, vector.z);

  if (length <= deadZone || length === 0) {
    return { x: 0, z: 0 };
  }

  const scale = Math.min(1, length) / length;
  return {
    x: vector.x * scale,
    z: vector.z * scale,
  };
}

export function mapScreenInputToWorldMovement(vector: VectorXZ): VectorXZ {
  const normalized = normalizeInputVector(vector);
  const invSqrt2 = Math.SQRT1_2;
  const world = {
    x: (normalized.x + normalized.z) * invSqrt2,
    z: (-normalized.x + normalized.z) * invSqrt2,
  };

  return normalizeInputVector(world);
}

export class InputSystem {
  private readonly keys = new Set<string>();
  private joystickVector: VectorXZ = { x: 0, z: 0 };
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code in KEY_VECTORS) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.code in KEY_VECTORS) {
      event.preventDefault();
      this.keys.delete(event.code);
    }
  };

  constructor(private readonly target: Window = window) {
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
  }

  setJoystickVector(vector: VectorXZ): void {
    this.joystickVector = normalizeInputVector(vector);
  }

  getMovementVector(): VectorXZ {
    let keyboard: VectorXZ = { x: 0, z: 0 };

    for (const code of this.keys) {
      const vector = KEY_VECTORS[code];
      keyboard = {
        x: keyboard.x + vector.x,
        z: keyboard.z + vector.z,
      };
    }

    const normalizedKeyboard = normalizeInputVector(keyboard);

    if (Math.hypot(this.joystickVector.x, this.joystickVector.z) > 0) {
      return this.joystickVector;
    }

    return normalizedKeyboard;
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.keys.clear();
  }
}
