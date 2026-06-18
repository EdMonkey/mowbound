import { BALANCE } from "../config/balance";
import { normalizeInputVector } from "../systems/InputSystem";
import type { VectorXZ } from "../types";

export class VirtualJoystick {
  readonly element = document.createElement("div");
  private readonly knob = document.createElement("div");
  private activePointerId?: number;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (vector: VectorXZ) => void,
  ) {
    this.element.className = "joystick";

    const base = document.createElement("div");
    base.className = "joystick-base";
    this.knob.className = "joystick-knob";
    this.element.append(base, this.knob);
    parent.appendChild(this.element);

    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("pointercancel", this.onPointerUp);
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle("visible", visible);
  }

  dispose(): void {
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.remove();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    this.updateFromPointer(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.updateFromPointer(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.activePointerId = undefined;
    this.knob.style.transform = "translate(0px, 0px)";
    this.onChange({ x: 0, z: 0 });
  };

  private updateFromPointer(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const radius = BALANCE.virtualJoystickRadiusPx;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const length = Math.hypot(rawX, rawY);
    const scale = length > radius ? radius / length : 1;
    const clampedX = rawX * scale;
    const clampedY = rawY * scale;

    this.knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
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
