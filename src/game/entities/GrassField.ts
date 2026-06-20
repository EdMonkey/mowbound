import * as THREE from "three";
import { cloneModel } from "../assets/models";
import type { GrassState } from "../types";

const SHAKE_TIME = 0.24;
const CHUNK_SIZE = 5; // world metres per chunk
const CHUNK_CAPACITY = 1024; // max grass per chunk
const SNAPSHOT_GRASS_POINT_SIZE = 4;
const SNAPSHOT_GRASS_Y = 0.18;
const SNAPSHOT_UNCUT_COLOR = { r: 0.12, g: 0.23, b: 0.115 };
const SNAPSHOT_UNCUT_VARIATION = { r: 0.025, g: 0.04, b: 0.02 };
const SNAPSHOT_CUT_COLOR = { r: 0.38, g: 0.62, b: 0.32 };
const SNAPSHOT_CUT_VARIATION = { r: 0.05, g: 0.07, b: 0.04 };

interface Chunk {
  mesh: THREE.InstancedMesh;
  count: number;
  dirty: boolean;
}

interface Instance {
  chunk: Chunk;
  index: number;
  x: number;
  z: number;
  hp: number;
  baseRotationY: number;
  scale: number;
  shakeTimer: number;
}

interface SnapshotDot {
  x: number;
  z: number;
}

/**
 * Grass rendered as one InstancedMesh **per spatial chunk** so the renderer can
 * frustum-cull whole chunks that are off-screen (each chunk gets a bounding
 * sphere covering its cell). On-screen cost stays roughly constant regardless
 * of map size. Per-clump random heading/scale and shake-on-hit are preserved.
 */
export class GrassField {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.Material;
  private readonly chunks = new Map<string, Chunk>();
  private readonly instances = new Map<string, Instance>();
  private readonly cutSnapshotDots: SnapshotDot[] = [];
  private readonly shaking = new Set<string>();

  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpScale = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    const source = cloneModel("grass");
    source.updateMatrixWorld(true);

    let mesh: THREE.Mesh | undefined;
    source.traverse((object) => {
      const candidate = object as THREE.Mesh;
      if (candidate.isMesh && !mesh) {
        mesh = candidate;
      }
    });

    // Bake the model world transform (incl. glTF Y-up) into the shared geometry.
    this.geometry = mesh ? mesh.geometry.clone() : new THREE.BufferGeometry();
    if (mesh) {
      this.geometry.applyMatrix4(mesh.matrixWorld);
    }
    this.material = (mesh?.material as THREE.Material) ?? new THREE.MeshStandardMaterial();
  }

  add(state: GrassState): void {
    const chunk = this.chunkFor(state.position.x, state.position.z);
    if (chunk.count >= CHUNK_CAPACITY) {
      return; // chunk full
    }
    const instance: Instance = {
      chunk,
      index: chunk.count,
      x: state.position.x,
      z: state.position.z,
      hp: state.hp,
      baseRotationY: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.4,
      shakeTimer: 0,
    };
    chunk.count += 1;
    chunk.mesh.count = chunk.count;
    this.instances.set(state.id, instance);
    this.writeMatrix(instance, 0, 0);
    chunk.dirty = true;
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
    this.cutSnapshotDots.push({ x: instance.x, z: instance.z });
    instance.chunk.mesh.setMatrixAt(instance.index, this.hidden);
    instance.chunk.dirty = true;
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
      instance.chunk.dirty = true;
    }

    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        chunk.mesh.instanceMatrix.needsUpdate = true;
        chunk.dirty = false;
      }
    }
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      chunk.mesh.dispose();
    }
    this.geometry.dispose();
    // Material is shared with the cached model; do not dispose it.
  }

  withFrustumCullingDisabled<T>(callback: () => T): T {
    const previous = Array.from(this.chunks.values()).map((chunk) => ({
      mesh: chunk.mesh,
      frustumCulled: chunk.mesh.frustumCulled,
    }));

    try {
      for (const chunk of this.chunks.values()) {
        if (chunk.dirty) {
          chunk.mesh.instanceMatrix.needsUpdate = true;
          chunk.dirty = false;
        }
        chunk.mesh.frustumCulled = false;
      }
      return callback();
    } finally {
      for (const state of previous) {
        state.mesh.frustumCulled = state.frustumCulled;
      }
    }
  }

  withSnapshotGrassVisible<T>(callback: () => T): T {
    const chunkVisibility = Array.from(this.chunks.values()).map((chunk) => ({
      mesh: chunk.mesh,
      visible: chunk.mesh.visible,
    }));
    const snapshotLayer = this.createSnapshotLayer();

    try {
      for (const state of chunkVisibility) {
        state.mesh.visible = false;
      }
      if (snapshotLayer) {
        this.group.add(snapshotLayer);
      }
      return callback();
    } finally {
      if (snapshotLayer) {
        this.group.remove(snapshotLayer);
        snapshotLayer.geometry.dispose();
        const material = snapshotLayer.material;
        if (Array.isArray(material)) {
          for (const entry of material) {
            entry.dispose();
          }
        } else {
          material.dispose();
        }
      }
      for (const state of chunkVisibility) {
        state.mesh.visible = state.visible;
      }
    }
  }

  private createSnapshotLayer(): THREE.Points | undefined {
    const dotCount = this.instances.size + this.cutSnapshotDots.length;
    if (dotCount === 0) {
      return undefined;
    }

    const positions = new Float32Array(dotCount * 3);
    const colors = new Float32Array(dotCount * 3);

    let index = 0;
    for (const instance of this.instances.values()) {
      this.writeSnapshotDot(positions, colors, index, instance, false);
      index += 1;
    }
    for (const dot of this.cutSnapshotDots) {
      this.writeSnapshotDot(positions, colors, index, dot, true);
      index += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: SNAPSHOT_GRASS_POINT_SIZE,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });

    const layer = new THREE.Points(geometry, material);
    layer.frustumCulled = false;
    layer.renderOrder = 40;
    return layer;
  }

  private writeSnapshotDot(
    positions: Float32Array,
    colors: Float32Array,
    index: number,
    dot: SnapshotDot,
    cut: boolean,
  ): void {
    const offset = index * 3;
    const shade = this.snapshotShade(dot.x, dot.z);
    const base = cut ? SNAPSHOT_CUT_COLOR : SNAPSHOT_UNCUT_COLOR;
    const variation = cut ? SNAPSHOT_CUT_VARIATION : SNAPSHOT_UNCUT_VARIATION;
    positions[offset] = dot.x;
    positions[offset + 1] = SNAPSHOT_GRASS_Y;
    positions[offset + 2] = dot.z;
    colors[offset] = base.r + shade * variation.r;
    colors[offset + 1] = base.g + shade * variation.g;
    colors[offset + 2] = base.b + shade * variation.b;
  }

  private snapshotShade(x: number, z: number): number {
    const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  private chunkFor(x: number, z: number): Chunk {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (chunk) {
      return chunk;
    }

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, CHUNK_CAPACITY);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true; // each chunk culls independently
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;

    // Bounding sphere covering this chunk's cell (+grass height/jitter margin).
    // The mesh sits at origin with world-space instances, so matrixWorld is
    // identity and this sphere is already in world space.
    const halfXZ = CHUNK_SIZE / 2 + 0.4;
    const center = new THREE.Vector3((cx + 0.5) * CHUNK_SIZE, 0.55, (cz + 0.5) * CHUNK_SIZE);
    mesh.boundingSphere = new THREE.Sphere(center, Math.sqrt(2 * halfXZ * halfXZ + 0.6 * 0.6));

    chunk = { mesh, count: 0, dirty: false };
    this.chunks.set(key, chunk);
    this.group.add(mesh);
    return chunk;
  }

  private writeMatrix(instance: Instance, shakeY: number, shakeZ: number): void {
    this.tmpEuler.set(0, instance.baseRotationY + shakeY, shakeZ);
    this.tmpQuat.setFromEuler(this.tmpEuler);
    this.tmpPos.set(instance.x, 0, instance.z);
    this.tmpScale.set(instance.scale, instance.scale, instance.scale);
    this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
    instance.chunk.mesh.setMatrixAt(instance.index, this.tmpMatrix);
  }
}
