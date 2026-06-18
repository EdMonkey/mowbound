import * as THREE from "three";
import type { VectorXZ } from "../types";

const coinMaterial = new THREE.MeshStandardMaterial({
  color: "#f0c85a",
  metalness: 0.45,
  roughness: 0.35,
  emissive: "#5e4810",
  emissiveIntensity: 0.2,
});

export class Coin {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly startY = 0.12;
  private readonly lifetime = 0.72;

  constructor(position: VectorXZ) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 24), coinMaterial);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    this.group.add(coin);
    this.group.position.set(position.x, this.startY, position.z);
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const t = Math.min(1, this.age / this.lifetime);
    this.group.position.y = this.startY + Math.sin(t * Math.PI) * 0.55 + t * 0.25;
    this.group.rotation.y += deltaSeconds * 9;
    this.group.scale.setScalar(1 - t * 0.55);
    return t >= 1;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
  }
}
