import * as THREE from "three";
import type { VectorXZ } from "../types";
import { cloneModel } from "../assets/models";

export class Coin {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly startY = 0.12;
  private readonly lifetime = 1.25;
  private verticalVelocity = 2.2;
  private bounceCount = 0;
  private readonly drift: VectorXZ;

  constructor(position: VectorXZ) {
    // The exported coin already lies flat (face up), so no extra rotation.
    this.group.add(cloneModel("coin"));
    this.group.position.set(position.x, this.startY, position.z);

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.25 + Math.random() * 0.18;
    this.drift = {
      x: Math.cos(angle) * speed,
      z: Math.sin(angle) * speed,
    };
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const t = Math.min(1, this.age / this.lifetime);

    this.group.position.x += this.drift.x * deltaSeconds * (1 - t * 0.55);
    this.group.position.z += this.drift.z * deltaSeconds * (1 - t * 0.55);
    this.verticalVelocity -= 7.2 * deltaSeconds;
    this.group.position.y += this.verticalVelocity * deltaSeconds;

    if (this.group.position.y <= this.startY) {
      this.group.position.y = this.startY;

      if (this.bounceCount < 3 && t < 0.88) {
        const bounceVelocity = [1.35, 0.78, 0.38][this.bounceCount] ?? 0;
        this.verticalVelocity = bounceVelocity;
        this.bounceCount += 1;
      } else {
        this.verticalVelocity = 0;
      }
    }

    this.group.rotation.y += deltaSeconds * 9;
    this.group.rotation.z += deltaSeconds * 6;
    this.group.scale.setScalar(Math.max(0.05, 1 - t * 0.82));
    return t >= 1;
  }

  dispose(): void {
    // Geometry and materials are shared with the cached model; only drop references.
    this.group.clear();
  }
}
