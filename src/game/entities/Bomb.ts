import * as THREE from "three";
import type { VectorXZ } from "../types";

const RADIUS = 0.28;

// Shared module-level geometry/material (like Coin/Player): each Bomb is its own
// Group of meshes that reference these singletons, so dispose() only drops refs.
const bodyGeometry = new THREE.SphereGeometry(RADIUS, 16, 12);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#15151c", roughness: 0.45, metalness: 0.5 });
const capGeometry = new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12);
const capMaterial = new THREE.MeshStandardMaterial({ color: "#3a2a18", roughness: 0.85 });
const blinkGeometry = new THREE.SphereGeometry(0.07, 10, 8);
const blinkMaterial = new THREE.MeshStandardMaterial({
  color: "#ff3b30",
  emissive: "#ff2a20",
  emissiveIntensity: 1.4,
  roughness: 0.4,
});

export class Bomb {
  readonly group = new THREE.Group();
  private readonly blink: THREE.Mesh;
  private phase = Math.random() * Math.PI * 2;

  constructor(position: VectorXZ) {
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.position.y = RADIUS;
    this.group.add(body);

    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = RADIUS * 2 - 0.02;
    this.group.add(cap);

    // Pulsing red light telegraphs the bomb (and its scale pulse is per-object,
    // so it stays independent of the shared emissive material).
    this.blink = new THREE.Mesh(blinkGeometry, blinkMaterial);
    this.blink.position.y = RADIUS * 2 + 0.12;
    this.group.add(this.blink);

    this.group.position.set(position.x, 0, position.z);
  }

  update(deltaSeconds: number): void {
    this.phase += deltaSeconds * 6;
    this.blink.scale.setScalar(0.7 + 0.4 * (0.5 + 0.5 * Math.sin(this.phase)));
  }

  dispose(): void {
    // Geometry/material are shared module singletons; just drop references.
    this.group.clear();
  }
}
