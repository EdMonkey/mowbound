import * as THREE from "three";
import { BALANCE } from "../config/balance";
import type { GrassState } from "../types";

const palette = ["#2f9f4b", "#4fb85f", "#7bc96f", "#236c3c"];

export class Grass {
  readonly group = new THREE.Group();

  constructor(public state: GrassState) {
    this.group.name = state.id;
    this.group.position.set(state.position.x, 0, state.position.z);

    const bladeCount = 5 + Math.floor(Math.random() * 5);

    for (let index = 0; index < bladeCount; index += 1) {
      const height = 0.18 + Math.random() * 0.22;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.025 + Math.random() * 0.018, height, 4),
        new THREE.MeshStandardMaterial({
          color: palette[Math.floor(Math.random() * palette.length)],
          roughness: 0.9,
        }),
      );
      const radius = Math.random() * 0.11;
      const angle = Math.random() * Math.PI * 2;
      blade.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      blade.rotation.y = Math.random() * Math.PI;
      blade.rotation.x = (Math.random() - 0.5) * 0.35;
      blade.rotation.z = (Math.random() - 0.5) * 0.35;
      blade.castShadow = true;
      this.group.add(blade);
    }
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
