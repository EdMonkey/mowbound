import * as THREE from "three";
import type { GrassState } from "../types";
import { cloneModel } from "../assets/models";

export class Grass {
  readonly group = new THREE.Group();
  private baseRotationY = 0;
  private shakeTimer = 0;

  constructor(public state: GrassState) {
    this.group.name = state.id;
    this.group.position.set(state.position.x, 0, state.position.z);
    this.group.add(cloneModel("grass"));

    // Spawn variety: random heading 0-360 degrees and 0.8x - 1.2x scale.
    this.baseRotationY = Math.random() * Math.PI * 2;
    this.group.rotation.y = this.baseRotationY;
    this.group.scale.setScalar(0.8 + Math.random() * 0.4);
  }

  setHp(hp: number): void {
    this.state = { ...this.state, hp };
    this.shakeTimer = 0.24;
  }

  update(deltaSeconds: number): void {
    this.shakeTimer = Math.max(0, this.shakeTimer - deltaSeconds);

    if (this.shakeTimer === 0) {
      this.group.rotation.y = this.baseRotationY;
      this.group.rotation.z = 0;
      return;
    }

    const progress = this.shakeTimer / 0.24;
    const wobble = Math.sin((1 - progress) * Math.PI * 6) * progress;
    this.group.rotation.y = this.baseRotationY + wobble * 0.16;
    this.group.rotation.z = wobble * 0.08;
  }

  dispose(): void {
    // Geometry and materials are shared with the cached model; only drop references.
    this.group.clear();
  }
}
