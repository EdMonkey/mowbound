import { BALANCE } from "../config/balance";
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

export function pointerToCenteredScreenMovement(
  pointer: { x: number; y: number },
  viewport: { width: number; height: number },
  deadZonePx = 0,
): VectorXZ {
  return normalizeInputVector(
    {
      x: pointer.x - viewport.width / 2,
      z: pointer.y - viewport.height / 2,
    },
    deadZonePx,
  );
}

export class InputSystem {
  private readonly keys = new Set<string>();
  private joystickVector: VectorXZ = { x: 0, z: 0 };
  private pointerVector: VectorXZ = { x: 0, z: 0 };
  private pointerActive = false;
  private pointerMovementEnabled = true;
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

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.pointerMovementEnabled || event.pointerType !== "mouse") {
      return;
    }

    this.pointerActive = true;
    this.pointerVector = pointerToCenteredScreenMovement(
      { x: event.clientX, y: event.clientY },
      { width: this.target.innerWidth, height: this.target.innerHeight },
      BALANCE.mouseMoveDeadZonePx,
    );
  };

  private readonly onPointerLeave = () => {
    this.pointerActive = false;
    this.pointerVector = { x: 0, z: 0 };
  };

  constructor(private readonly target: Window = window) {
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    this.target.addEventListener("pointermove", this.onPointerMove);
    this.target.addEventListener("pointerleave", this.onPointerLeave);
    this.target.addEventListener("blur", this.onPointerLeave);
  }

  setJoystickVector(vector: VectorXZ): void {
    this.joystickVector = normalizeInputVector(vector);
  }

  setPointerMovementEnabled(enabled: boolean): void {
    this.pointerMovementEnabled = enabled;

    if (!enabled) {
      this.onPointerLeave();
    }
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

    if (this.pointerMovementEnabled && this.pointerActive) {
      return this.pointerVector;
    }

    return normalizedKeyboard;
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerleave", this.onPointerLeave);
    this.target.removeEventListener("blur", this.onPointerLeave);
    this.keys.clear();
  }
}
