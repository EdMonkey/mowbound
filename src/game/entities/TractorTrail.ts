import * as THREE from "three";
import type { VectorXZ } from "../types";

export class TractorTrail {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private age = 0;

  constructor(origin: VectorXZ, direction: VectorXZ, length: number, width: number) {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshBasicMaterial({
        color: "#b4d38f",
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.x = length / 2;
    this.group.add(this.mesh);
    this.group.position.set(origin.x, 0.055, origin.z);
    this.group.rotation.y = -Math.atan2(direction.z, direction.x);
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const t = Math.min(1, this.age / 0.8);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.24 * (1 - t);
    return t >= 1;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
