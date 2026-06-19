import * as THREE from "three";
import type { VectorXZ } from "../types";
import { cloneModel } from "../assets/models";

const COIN_GROW_TIME = 0.12; // pop-in: grow to full size
const COIN_SHRINK_TIME = 0.3; // shrink out over the last 0.3s before it vanishes

export class Coin {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly startY = 0.18;
  private readonly lifetime = 2.5;
  private verticalVelocity = 3.6;
  private bounceCount = 0;
  private readonly drift: VectorXZ;
  private readonly spinY: number;
  private readonly spinZ: number;

  constructor(position: VectorXZ, origin: VectorXZ = position) {
    // The exported coin already lies flat (face up), so no extra rotation.
    const coin = cloneModel("coin");
    coin.scale.setScalar(0.75);
    this.group.add(coin);
    this.group.position.set(position.x, this.startY, position.z);

    // Burst outward from the character (origin), with a ~15% offset on the
    // direction and intensity.
    const dx = position.x - origin.x;
    const dz = position.z - origin.z;
    const radial = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
    const angle = radial + (Math.random() * 2 - 1) * Math.PI * 0.15;
    const speed = 1.4 * (1 + (Math.random() * 2 - 1) * 0.15);
    this.drift = {
      x: Math.cos(angle) * speed,
      z: Math.sin(angle) * speed,
    };

    this.verticalVelocity *= 1 + Math.random() * 0.5; // pop 1x–1.5x height
    this.spinY = (Math.random() < 0.5 ? -1 : 1) * 9; // random spin direction
    this.spinZ = (Math.random() < 0.5 ? -1 : 1) * 6;
    this.group.rotation.y = Math.random() * Math.PI * 2;
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
        const bounceVelocity = [1.9, 1.05, 0.5][this.bounceCount] ?? 0;
        this.verticalVelocity = bounceVelocity;
        this.bounceCount += 1;
      } else {
        this.verticalVelocity = 0;
      }
    }

    this.group.rotation.y += this.spinY * deltaSeconds;
    this.group.rotation.z += this.spinZ * deltaSeconds;

    // Pop in (grow), hold, then shrink away over the last 0.3s.
    let scale: number;
    if (this.age < COIN_GROW_TIME) {
      scale = this.age / COIN_GROW_TIME;
    } else if (this.age > this.lifetime - COIN_SHRINK_TIME) {
      scale = Math.max(0, (this.lifetime - this.age) / COIN_SHRINK_TIME);
    } else {
      scale = 1;
    }
    this.group.scale.setScalar(scale);

    return t >= 1;
  }

  dispose(): void {
    // Geometry and materials are shared with the cached model; only drop references.
    this.group.clear();
  }
}
