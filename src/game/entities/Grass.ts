import * as THREE from "three";
import type { GrassState } from "../types";

const palette = ["#2f9f4b", "#4fb85f", "#7bc96f", "#236c3c"];
const bladeGeometry = new THREE.BoxGeometry(0.045, 0.32, 0.035);

export class Grass {
  readonly group = new THREE.Group();
  private baseRotationY = 0;
  private shakeTimer = 0;

  constructor(public state: GrassState) {
    this.group.name = state.id;
    this.group.position.set(state.position.x, 0, state.position.z);

    const bladeConfigs = [
      { height: 0.38, width: 0.052, lean: -0.28, yaw: -0.34, offset: -0.045 },
      { height: 0.3, width: 0.042, lean: 0.2, yaw: 0.12, offset: 0.02 },
      { height: 0.44, width: 0.048, lean: 0.33, yaw: 0.42, offset: 0.055 },
    ];

    for (let index = 0; index < bladeConfigs.length; index += 1) {
      const config = bladeConfigs[index];
      const blade = new THREE.Mesh(
        bladeGeometry.clone(),
        new THREE.MeshStandardMaterial({
          color: palette[Math.floor(Math.random() * palette.length)],
          roughness: 0.9,
        }),
      );
      blade.scale.set(config.width / 0.045, config.height / 0.32, 1);
      blade.position.set(config.offset, config.height / 2, 0);
      blade.rotation.set(config.lean, config.yaw + Math.random() * 0.18, config.lean * 0.45);
      blade.castShadow = true;
      this.group.add(blade);
    }

    this.baseRotationY = Math.random() * Math.PI * 2;
    this.group.rotation.y = this.baseRotationY;
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
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material.dispose();
        }
      }
    });
  }
}
