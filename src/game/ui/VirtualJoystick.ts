import { BALANCE } from "../config/balance";
import { normalizeInputVector } from "../systems/InputSystem";
import type { VectorXZ } from "../types";

/**
 * Floating touch joystick: a full-screen zone that spawns the control wherever
 * the player first touches, and tracks movement relative to that origin. Only
 * touch/pen pointers trigger it, so desktop mouse/keyboard is unaffected.
 */
export class VirtualJoystick {
  readonly element = document.createElement("div");
  private readonly base = document.createElement("div");
  private readonly knob = document.createElement("div");
  private activePointerId?: number;
  private origin: VectorXZ = { x: 0, z: 0 };
  private enabled = false;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (vector: VectorXZ) => void,
  ) {
    this.element.className = "joystick-zone";
    this.base.className = "joystick-base";
    this.knob.className = "joystick-knob";
    this.element.append(this.base, this.knob);
    parent.appendChild(this.element);

    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("pointercancel", this.onPointerUp);
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    this.element.classList.toggle("active", visible);
    if (!visible) {
      this.reset();
    }
  }

  dispose(): void {
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.remove();
  }

  private reset(): void {
    this.activePointerId = undefined;
    this.element.classList.remove("engaged");
    this.onChange({ x: 0, z: 0 });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.activePointerId !== undefined || event.pointerType === "mouse") {
      return;
    }
    event.preventDefault();
    this.activePointerId = event.pointerId;
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic or already-captured pointer */
    }

    const rect = this.element.getBoundingClientRect();
    this.origin = { x: event.clientX - rect.left, z: event.clientY - rect.top };
    this.base.style.left = `${this.origin.x}px`;
    this.base.style.top = `${this.origin.z}px`;
    this.element.classList.add("engaged");
    this.updateFromPointer(event, rect);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.updateFromPointer(event, this.element.getBoundingClientRect());
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.reset();
  };

  private updateFromPointer(event: PointerEvent, rect: DOMRect): void {
    const radius = BALANCE.virtualJoystickRadiusPx;
    const rawX = event.clientX - rect.left - this.origin.x;
    const rawY = event.clientY - rect.top - this.origin.z;
    const length = Math.hypot(rawX, rawY);
    const scale = length > radius ? radius / length : 1;
    const clampedX = rawX * scale;
    const clampedY = rawY * scale;

    this.knob.style.left = `${this.origin.x + clampedX}px`;
    this.knob.style.top = `${this.origin.z + clampedY}px`;
    this.onChange(
      normalizeInputVector(
        {
          x: clampedX / radius,
          z: clampedY / radius,
        },
        BALANCE.virtualJoystickDeadZone,
      ),
    );
  }
}
