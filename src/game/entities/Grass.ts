import * as THREE from "three";
import { BALANCE } from "../config/balance";
import type { GrassState } from "../types";

const palette = ["#2f9f4b", "#4fb85f", "#7bc96f", "#236c3c"];
const bladeGeometry = new THREE.BoxGeometry(0.045, 0.32, 0.035);

export class Grass {
  readonly group = new THREE.Group();

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

    this.group.rotation.y = Math.random() * Math.PI * 2;
  }

  setHp(hp: number): void {
    this.state = { ...this.state, hp };
    const healthRatio = THREE.MathUtils.clamp(hp / BALANCE.baseGrassHp, 0.28, 1);
    this.group.scale.setScalar(healthRatio);
  }

  flatten(): void {
    this.group.scale.y = 0.12;
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
