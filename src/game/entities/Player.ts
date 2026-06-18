import * as THREE from "three";
import type { VectorXZ } from "../types";
import { cloneModel } from "../assets/models";

export class Player {
  readonly group = new THREE.Group();
  readonly position: VectorXZ = { x: 0, z: 0 };
  readonly direction: VectorXZ = { x: 1, z: 0 };
  private readonly tool = new THREE.Group();
  private strikeTimer = 0;

  constructor() {
    this.group.name = "Player";

    const body = cloneModel("farmer");
    this.group.add(body);

    // Korean hand sickle, held in the right hand (+Z side) at hip height and
    // swung on strike(). The model's handle runs along +X (the character's
    // forward axis), so identity rotation points it toward the front.
    const sickle = cloneModel("sickle");
    sickle.rotation.set(0, 0, 0);
    this.tool.add(sickle);
    this.tool.position.set(0.12, 0.42, 0.08);
    this.tool.scale.setScalar(0.8);
    this.group.add(this.tool);

    this.syncTransform();
  }

  move(vector: VectorXZ, speed: number, deltaSeconds: number, mapSize: number): void {
    if (Math.hypot(vector.x, vector.z) > 0) {
      this.direction.x = vector.x;
      this.direction.z = vector.z;
    }

    const half = mapSize / 2 - 0.24;
    this.position.x = THREE.MathUtils.clamp(this.position.x + vector.x * speed * deltaSeconds, -half, half);
    this.position.z = THREE.MathUtils.clamp(this.position.z + vector.z * speed * deltaSeconds, -half, half);
    this.syncTransform();
  }

  strike(): void {
    this.strikeTimer = 0.18;
  }

  update(deltaSeconds: number): void {
    this.strikeTimer = Math.max(0, this.strikeTimer - deltaSeconds);
    const strikeProgress = this.strikeTimer > 0 ? this.strikeTimer / 0.18 : 0;
    this.tool.rotation.y = -Math.sin((1 - strikeProgress) * Math.PI) * 1.3;
    this.tool.rotation.z = Math.sin((1 - strikeProgress) * Math.PI) * 0.28;
  }

  private syncTransform(): void {
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = -Math.atan2(this.direction.z, this.direction.x);
  }
}
