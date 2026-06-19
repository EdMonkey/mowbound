import * as THREE from "three";
import type { VectorXZ } from "../types";

export class CropMark {
  readonly group = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly shockwave: THREE.Mesh;
  private age = 0;

  constructor(center: VectorXZ, radius: number) {
    this.group.position.set(center.x, 0.09, center.z);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.74, radius, 96),
      new THREE.MeshBasicMaterial({
        color: "#72f0d6",
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    this.shockwave = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.1, radius * 0.16, 64),
      new THREE.MeshBasicMaterial({
        color: "#effff8",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.shockwave.rotation.x = -Math.PI / 2;
    this.group.add(this.shockwave);
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const warning = Math.min(1, this.age / 0.4);
    const impact = Math.max(0, Math.min(1, (this.age - 0.4) / 0.45));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - impact);
    (this.shockwave.material as THREE.MeshBasicMaterial).opacity = 0.72 * (1 - impact);
    this.shockwave.scale.setScalar(1 + impact * 6);
    this.group.rotation.y = warning * Math.PI * 0.35;
    return this.age >= 0.85;
  }

  dispose(): void {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.shockwave.geometry.dispose();
    (this.shockwave.material as THREE.Material).dispose();
  }
}
