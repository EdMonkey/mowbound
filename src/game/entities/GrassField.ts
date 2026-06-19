import * as THREE from "three";
import { cloneModel } from "../assets/models";
import type { GrassState } from "../types";

interface Instance {
  index: number;
  x: number;
  z: number;
  hp: number;
  baseRotationY: number;
  scale: number;
  shakeTimer: number;
}

const SHAKE_TIME = 0.24;

/**
 * Renders every grass clump as a single InstancedMesh (one draw call) while
 * keeping per-clump gameplay state. Each instance still gets a random heading
 * and 0.8x-1.2x scale, shakes when hit, and is hidden when destroyed.
 */
export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private readonly instances = new Map<string, Instance>();
  private readonly shaking = new Set<string>();
  private next = 0;
  private dirty = false;

  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpScale = new THREE.Vector3();

  constructor(capacity: number) {
    const source = cloneModel("grass");
    source.updateMatrixWorld(true);

    let mesh: THREE.Mesh | undefined;
    source.traverse((object) => {
      const candidate = object as THREE.Mesh;
      if (candidate.isMesh && !mesh) {
        mesh = candidate;
      }
    });

    // Bake the model's world transform (incl. glTF Y-up) into the geometry so
    // instance matrices only carry position/heading/scale.
    const geometry = mesh ? mesh.geometry.clone() : new THREE.BufferGeometry();
    if (mesh) {
      geometry.applyMatrix4(mesh.matrixWorld);
    }
    const material = (mesh?.material as THREE.Material) ?? new THREE.MeshStandardMaterial();

    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, capacity));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
  }

  add(state: GrassState): void {
    if (this.next >= this.mesh.instanceMatrix.count) {
      return; // at capacity
    }
    const instance: Instance = {
      index: this.next,
      x: state.position.x,
      z: state.position.z,
      hp: state.hp,
      baseRotationY: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.4,
      shakeTimer: 0,
    };
    this.instances.set(state.id, instance);
    this.next += 1;
    this.mesh.count = this.next;
    this.writeMatrix(instance, 0, 0);
    this.dirty = true;
  }

  getStates(): GrassState[] {
    const out: GrassState[] = [];
    for (const [id, instance] of this.instances) {
      out.push({ id, position: { x: instance.x, z: instance.z }, hp: instance.hp });
    }
    return out;
  }

  setHp(id: string, hp: number): void {
    const instance = this.instances.get(id);
    if (!instance) {
      return;
    }
    instance.hp = hp;
    instance.shakeTimer = SHAKE_TIME;
    this.shaking.add(id);
  }

  destroy(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) {
      return;
    }
    this.instances.delete(id);
    this.shaking.delete(id);
    this.tmpMatrix.makeScale(0, 0, 0); // collapse to hide
    this.mesh.setMatrixAt(instance.index, this.tmpMatrix);
    this.dirty = true;
  }

  update(deltaSeconds: number): void {
    for (const id of this.shaking) {
      const instance = this.instances.get(id);
      if (!instance) {
        this.shaking.delete(id);
        continue;
      }
      instance.shakeTimer = Math.max(0, instance.shakeTimer - deltaSeconds);
      if (instance.shakeTimer === 0) {
        this.writeMatrix(instance, 0, 0);
        this.shaking.delete(id);
      } else {
        const progress = instance.shakeTimer / SHAKE_TIME;
        const wobble = Math.sin((1 - progress) * Math.PI * 6) * progress;
        this.writeMatrix(instance, wobble * 0.16, wobble * 0.08);
      }
      this.dirty = true;
    }

    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    // Material is shared with the cached model; do not dispose it.
    this.mesh.dispose();
  }

  private writeMatrix(instance: Instance, shakeY: number, shakeZ: number): void {
    this.tmpEuler.set(0, instance.baseRotationY + shakeY, shakeZ);
    this.tmpQuat.setFromEuler(this.tmpEuler);
    this.tmpPos.set(instance.x, 0, instance.z);
    this.tmpScale.set(instance.scale, instance.scale, instance.scale);
    this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
    this.mesh.setMatrixAt(instance.index, this.tmpMatrix);
  }
}
