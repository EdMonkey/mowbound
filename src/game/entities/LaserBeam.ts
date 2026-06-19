import * as THREE from "three";
import type { VectorXZ } from "../types";

export class LaserBeam {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private age = 0;

  constructor(origin: VectorXZ, direction: VectorXZ, length: number, width: number) {
    const material = new THREE.MeshBasicMaterial({
      color: "#9ff7ff",
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, width), material);
    this.mesh.position.x = length / 2;
    this.group.add(this.mesh);
    this.group.position.set(origin.x, 0.18, origin.z);
    this.group.rotation.y = -Math.atan2(direction.z, direction.x);
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const t = Math.min(1, this.age / 0.15);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.78 * (1 - t);
    this.mesh.scale.z = 1 + t * 1.4;
    return t >= 1;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
