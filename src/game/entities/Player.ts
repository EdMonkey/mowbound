import * as THREE from "three";
import type { VectorXZ } from "../types";

const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#f2d38b", roughness: 0.85 });
const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#4f7fc8", roughness: 0.82 });
const headMaterial = new THREE.MeshStandardMaterial({ color: "#f0bd8b", roughness: 0.8 });
const scytheMaterial = new THREE.MeshStandardMaterial({ color: "#2b332f", roughness: 0.65 });
const bladeMaterial = new THREE.MeshStandardMaterial({ color: "#dfe8de", metalness: 0.25, roughness: 0.32 });
const markerMaterial = new THREE.MeshStandardMaterial({ color: "#f0c85a", roughness: 0.55 });

export class Player {
  readonly group = new THREE.Group();
  readonly position: VectorXZ = { x: 0, z: 0 };
  readonly direction: VectorXZ = { x: 1, z: 0 };
  private readonly scythe = new THREE.Group();
  private strikeTimer = 0;

  constructor() {
    this.group.name = "Player";
    this.group.scale.setScalar(0.62);

    const feet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 12), bodyMaterial);
    feet.position.y = 0.08;
    feet.castShadow = true;
    this.group.add(feet);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 5, 12), shirtMaterial);
    body.position.y = 0.44;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), headMaterial);
    head.position.y = 0.83;
    head.castShadow = true;
    this.group.add(head);

    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 3), markerMaterial);
    marker.position.set(0.34, 0.62, 0);
    marker.rotation.z = -Math.PI / 2;
    marker.castShadow = true;
    this.group.add(marker);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), scytheMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.28, 0.46, -0.16);
    handle.castShadow = true;
    this.scythe.add(handle);

    const blade = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24, Math.PI), bladeMaterial);
    blade.position.set(0.62, 0.46, -0.16);
    blade.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    blade.castShadow = true;
    this.scythe.add(blade);
    this.group.add(this.scythe);

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
    this.scythe.rotation.y = -Math.sin((1 - strikeProgress) * Math.PI) * 1.3;
    this.scythe.rotation.z = Math.sin((1 - strikeProgress) * Math.PI) * 0.28;
  }

  private syncTransform(): void {
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = -Math.atan2(this.direction.z, this.direction.x);
  }
}
