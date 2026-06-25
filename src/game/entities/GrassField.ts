import * as THREE from "three";
import { cloneModel } from "../assets/models";
import { BALANCE } from "../config/balance";
import type { GrassKind, GrassState, VectorXZ } from "../types";

const SHAKE_TIME = 0.24;
const CHUNK_SIZE = 5; // world metres per chunk
const CHUNK_CAPACITY = 1024; // max grass per chunk

interface Chunk {
  mesh: THREE.InstancedMesh;
  fireMesh: THREE.InstancedMesh;
  count: number;
  dirty: boolean;
  fireDirty: boolean;
}

interface GrowthZone {
  x: number;
  z: number;
  radius: number;
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
  burningSeconds: number;
  kind: GrassKind;
  growthRatio: number;
  regrowDelay: number;
  baseHp: number;
}

export class GrassField {
  readonly group = new THREE.Group();
  /** 스킬로 조정 가능 — GameScene이 초기화 후 덮어씀 */
  regrowDelaySeconds: number = BALANCE.grassRegrowDelaySeconds;
  regrowDurationSeconds: number = BALANCE.grassRegrowDurationSeconds;

  // Obstacle auras: rocks suppress regrowth in range, trees accelerate it.
  private growthSuppressZones: ReadonlyArray<GrowthZone> = [];
  private growthBoostZones: ReadonlyArray<GrowthZone> = [];
  private growthBoostMultiplier = 1;

  private readonly geometry: THREE.BufferGeometry;
  private readonly fireGeometry: THREE.ConeGeometry;
  private readonly material: THREE.Material;
  private readonly fireMaterial: THREE.MeshBasicMaterial;
  private readonly chunks = new Map<string, Chunk>();
  private readonly instances = new Map<string, Instance>();
  private readonly shaking = new Set<string>();
  // Ids currently on fire — lets per-frame work skip the full grass set when
  // nothing is burning (huge win on large maps with tens of thousands of patches).
  private readonly burning = new Set<string>();

  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpScale = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly tmpColor = new THREE.Color();

  // 풀 색상 상수
  private readonly grassGreenColor = new THREE.Color("#5ab030");
  private readonly emberColor    = new THREE.Color("#ff6b1a");
  private readonly tallKindColor  = new THREE.Color("#c8d44a");
  private readonly blueKindColor  = new THREE.Color("#4ab8d4");
  private readonly timerKindColor = new THREE.Color("#3de84a");

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

    this.geometry = mesh ? mesh.geometry.clone() : new THREE.BufferGeometry();
    if (mesh) {
      this.geometry.applyMatrix4(mesh.matrixWorld);
    }
    this.material = ((mesh?.material as THREE.Material | undefined)?.clone() as THREE.Material | undefined) ??
      new THREE.MeshStandardMaterial();

    // instanceColor가 색상을 완전히 제어하도록 material color를 white로 설정
    if (this.material instanceof THREE.MeshStandardMaterial) {
      this.material.color.set(0xffffff);
    }

    this.fireGeometry = new THREE.ConeGeometry(0.055, 0.22, 5);
    this.fireMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      vertexColors: true,
    });
  }

  add(state: GrassState): void {
    const chunk = this.chunkFor(state.position.x, state.position.z);
    if (chunk.count >= CHUNK_CAPACITY) return;

    const kind = state.kind;
    const baseHp = kind === "tall"
      ? BALANCE.baseGrassHp * BALANCE.tallGrassHpMultiplier
      : BALANCE.baseGrassHp;
    const instance: Instance = {
      chunk,
      index: chunk.count,
      x: state.position.x,
      z: state.position.z,
      hp: state.hp,
      baseRotationY: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.4,
      shakeTimer: 0,
      burningSeconds: state.burningSeconds ?? 0,
      kind,
      growthRatio: state.growthRatio,
      regrowDelay: state.regrowDelay,
      baseHp,
    };
    chunk.count += 1;
    chunk.mesh.count = chunk.count;
    chunk.fireMesh.count = chunk.count;
    this.instances.set(state.id, instance);
    this.writeMatrix(instance, 0, 0);
    this.writeMeshColor(instance);
    this.writeFire(instance);
    chunk.dirty = true;
    chunk.fireDirty = true;
  }

  getStates(): GrassState[] {
    const out: GrassState[] = [];
    for (const [id, instance] of this.instances) {
      out.push({
        id,
        position: { x: instance.x, z: instance.z },
        hp: instance.hp,
        kind: instance.kind,
        growthRatio: instance.growthRatio,
        regrowDelay: instance.regrowDelay,
        ...(instance.burningSeconds > 0 ? { burningSeconds: instance.burningSeconds } : {}),
      });
    }
    return out;
  }

  /** True if any grass is currently on fire (cheap — no allocation). */
  hasBurning(): boolean {
    return this.burning.size > 0;
  }

  /** Positions of currently-burning grass, for fire VFX. Empty when none burn. */
  getBurningPositions(): VectorXZ[] {
    const out: VectorXZ[] = [];
    for (const id of this.burning) {
      const instance = this.instances.get(id);
      if (instance && instance.burningSeconds > 0) {
        out.push({ x: instance.x, z: instance.z });
      }
    }
    return out;
  }

  /** Whether grown blue grass sits within `radius` of a point — no allocation, early-exits. */
  isOnBlueGrass(px: number, pz: number, radius: number): boolean {
    const r2 = radius * radius;
    for (const instance of this.instances.values()) {
      if (instance.kind !== "blue" || instance.growthRatio <= 0.5) continue;
      const dx = instance.x - px;
      const dz = instance.z - pz;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  setHp(id: string, hp: number, options: { shake?: boolean; burningSeconds?: number } = {}): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    instance.hp = hp;
    // Colour no longer depends on HP, so a plain damage tick writes nothing to
    // the colour/fire buffers — only a burning-state change does.
    if (options.burningSeconds !== undefined) {
      instance.burningSeconds = options.burningSeconds;
      if (options.burningSeconds > 0) this.burning.add(id);
      else this.burning.delete(id);
      this.writeMeshColor(instance);
      this.writeFire(instance);
      instance.chunk.dirty = true;
      instance.chunk.fireDirty = true;
    }
    if (options.shake ?? true) {
      instance.shakeTimer = SHAKE_TIME;
      this.shaking.add(id);
    }
  }

  ignite(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (instance.growthRatio < 0.5) return;
    instance.burningSeconds = BALANCE.fireDurationSeconds;
    this.burning.add(id);
    this.writeMeshColor(instance);
    this.writeFire(instance);
    instance.chunk.dirty = true;
    instance.chunk.fireDirty = true;
  }

  destroy(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    this.shaking.delete(id);
    this.burning.delete(id);
    instance.growthRatio = 0;
    instance.regrowDelay = this.regrowDelaySeconds;
    instance.hp = instance.baseHp;
    instance.burningSeconds = 0;
    instance.chunk.mesh.setMatrixAt(instance.index, this.hidden);
    instance.chunk.fireMesh.setMatrixAt(instance.index, this.hidden);
    instance.chunk.dirty = true;
    instance.chunk.fireDirty = true;
  }

  /** Change an existing patch's kind in place (used to relocate special grass). */
  setKind(id: string, kind: GrassKind): void {
    const instance = this.instances.get(id);
    if (!instance || instance.kind === kind) return;
    instance.kind = kind;
    instance.baseHp = kind === "tall"
      ? BALANCE.baseGrassHp * BALANCE.tallGrassHpMultiplier
      : BALANCE.baseGrassHp;
    instance.hp = instance.baseHp * instance.growthRatio;
    this.writeMatrix(instance, 0, 0); // tall changes the Y scale
    this.writeMeshColor(instance);
    instance.chunk.dirty = true;
  }

  /** Obstacle auras affecting regrowth: rocks suppress, trees boost. */
  setGrowthZones(
    suppress: ReadonlyArray<GrowthZone>,
    boost: ReadonlyArray<GrowthZone>,
    boostMultiplier: number,
  ): void {
    this.growthSuppressZones = suppress;
    this.growthBoostZones = boost;
    this.growthBoostMultiplier = boostMultiplier;
  }

  private inAnyZone(instance: Instance, zones: ReadonlyArray<GrowthZone>): boolean {
    for (const zone of zones) {
      const dx = instance.x - zone.x;
      const dz = instance.z - zone.z;
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }

  update(deltaSeconds: number): void {
    for (const id of this.burning) {
      const instance = this.instances.get(id);
      if (!instance || instance.burningSeconds <= 0) {
        this.burning.delete(id);
        continue;
      }
      instance.burningSeconds = Math.max(0, instance.burningSeconds - deltaSeconds);
      this.writeFire(instance);
      instance.chunk.fireDirty = true;
      // Colour only needs rewriting when the fire goes out (ember tint -> kind).
      if (instance.burningSeconds === 0) {
        this.burning.delete(id);
        this.writeMeshColor(instance);
        instance.chunk.dirty = true;
      }
    }

    for (const id of this.shaking) {
      const instance = this.instances.get(id);
      if (!instance) {
        this.shaking.delete(id);
        continue;
      }
      instance.shakeTimer = Math.max(0, instance.shakeTimer - deltaSeconds);
      if (instance.shakeTimer === 0) {
        this.writeMatrix(instance, 0, 0);
        this.writeFire(instance);
        this.shaking.delete(id);
      } else {
        const progress = instance.shakeTimer / SHAKE_TIME;
        const wobble = Math.sin((1 - progress) * Math.PI * 6) * progress;
        this.writeMatrix(instance, wobble * 0.16, wobble * 0.08);
      }
      instance.chunk.dirty = true;
      instance.chunk.fireDirty = true;
    }

    for (const instance of this.instances.values()) {
      if (instance.regrowDelay > 0) {
        instance.regrowDelay = Math.max(0, instance.regrowDelay - deltaSeconds);
        continue;
      }
      if (instance.growthRatio < 1) {
        // Rocks pause regrowth in their aura; trees speed it up.
        if (this.inAnyZone(instance, this.growthSuppressZones)) {
          continue;
        }
        const mult = this.inAnyZone(instance, this.growthBoostZones) ? this.growthBoostMultiplier : 1;
        instance.growthRatio = Math.min(1, instance.growthRatio + (deltaSeconds * mult) / this.regrowDurationSeconds);
        instance.hp = instance.baseHp * instance.growthRatio;
        this.writeMatrix(instance, 0, 0);
        instance.chunk.dirty = true;
      }
    }

    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        // Only the transform buffer; colour is flagged directly by
        // writeMeshColor on the rare occasions it actually changes.
        chunk.mesh.instanceMatrix.needsUpdate = true;
        chunk.dirty = false;
      }
      if (chunk.fireDirty) {
        chunk.fireMesh.instanceMatrix.needsUpdate = true;
        if (chunk.fireMesh.instanceColor) {
          chunk.fireMesh.instanceColor.needsUpdate = true;
        }
        chunk.fireDirty = false;
      }
    }
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      chunk.mesh.dispose();
      chunk.fireMesh.dispose();
    }
    this.geometry.dispose();
    this.fireGeometry.dispose();
    this.material.dispose();
    this.fireMaterial.dispose();
  }

  withFrustumCullingDisabled<T>(callback: () => T): T {
    const previous = Array.from(this.chunks.values()).map((chunk) => ({
      mesh: chunk.mesh,
      fireMesh: chunk.fireMesh,
      frustumCulled: chunk.mesh.frustumCulled,
      fireFrustumCulled: chunk.fireMesh.frustumCulled,
    }));

    try {
      for (const chunk of this.chunks.values()) {
        if (chunk.dirty) {
          chunk.mesh.instanceMatrix.needsUpdate = true;
          chunk.dirty = false;
        }
        chunk.mesh.frustumCulled = false;
        chunk.fireMesh.frustumCulled = false;
      }
      return callback();
    } finally {
      for (const state of previous) {
        state.mesh.frustumCulled = state.frustumCulled;
        state.fireMesh.frustumCulled = state.fireFrustumCulled;
      }
    }
  }

  withSnapshotGrassVisible<T>(callback: () => T): T {
    return this.withFrustumCullingDisabled(callback);
  }

  private chunkFor(x: number, z: number): Chunk {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, CHUNK_CAPACITY);
    const fireMesh = new THREE.InstancedMesh(this.fireGeometry, this.fireMaterial, CHUNK_CAPACITY);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    fireMesh.castShadow = false;
    fireMesh.receiveShadow = false;
    fireMesh.frustumCulled = true;
    fireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fireMesh.count = 0;

    const halfXZ = CHUNK_SIZE / 2 + 0.4;
    const center = new THREE.Vector3((cx + 0.5) * CHUNK_SIZE, 0.55, (cz + 0.5) * CHUNK_SIZE);
    mesh.boundingSphere = new THREE.Sphere(center, Math.sqrt(2 * halfXZ * halfXZ + 0.6 * 0.6));
    fireMesh.boundingSphere = mesh.boundingSphere;

    chunk = { mesh, fireMesh, count: 0, dirty: false, fireDirty: false };
    this.chunks.set(key, chunk);
    this.group.add(mesh);
    this.group.add(fireMesh);
    return chunk;
  }

  private writeMatrix(instance: Instance, shakeY: number, shakeZ: number): void {
    if (instance.growthRatio === 0) {
      instance.chunk.mesh.setMatrixAt(instance.index, this.hidden);
      return;
    }
    this.tmpEuler.set(0, instance.baseRotationY + shakeY, shakeZ);
    this.tmpQuat.setFromEuler(this.tmpEuler);
    this.tmpPos.set(instance.x, 0, instance.z);
    const maxYScale = instance.kind === "tall" ? BALANCE.tallGrassYScale : 1.0;
    const yScale = instance.scale * maxYScale * instance.growthRatio;
    this.tmpScale.set(instance.scale, yScale, instance.scale);
    this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
    instance.chunk.mesh.setMatrixAt(instance.index, this.tmpMatrix);
  }

  /**
   * Colour depends only on the patch's kind (plus a burning tint) — NOT on HP.
   * This means it only needs writing when the kind or burning state changes, so
   * routine damage/regrowth no longer re-uploads the per-instance colour buffer
   * (which got expensive on large maps).
   */
  private writeMeshColor(instance: Instance): void {
    switch (instance.kind) {
      case "blue":
        this.tmpColor.copy(this.blueKindColor);
        break;
      case "timer":
        this.tmpColor.copy(this.timerKindColor);
        break;
      case "tall":
        this.tmpColor.copy(this.tallKindColor);
        break;
      default: // normal
        this.tmpColor.copy(this.grassGreenColor);
    }

    if (instance.burningSeconds > 0) {
      this.tmpColor.lerp(this.emberColor, 0.55);
    }

    instance.chunk.mesh.setColorAt(instance.index, this.tmpColor);
    if (instance.chunk.mesh.instanceColor) {
      instance.chunk.mesh.instanceColor.needsUpdate = true;
    }
  }

  private writeFire(instance: Instance): void {
    if (instance.burningSeconds <= 0) {
      instance.chunk.fireMesh.setMatrixAt(instance.index, this.hidden);
      return;
    }

    const pulse = 0.82 + Math.sin(performance.now() * 0.018 + instance.index) * 0.18;
    this.tmpEuler.set(0, instance.baseRotationY + performance.now() * 0.004, 0);
    this.tmpQuat.setFromEuler(this.tmpEuler);
    this.tmpPos.set(instance.x, 0.28 + pulse * 0.035, instance.z);
    this.tmpScale.set(instance.scale * pulse, instance.scale * (0.85 + pulse * 0.35), instance.scale * pulse);
    this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
    instance.chunk.fireMesh.setMatrixAt(instance.index, this.tmpMatrix);
    this.tmpColor.set(pulse > 0.92 ? "#ffd35a" : "#ff6b1a");
    instance.chunk.fireMesh.setColorAt(instance.index, this.tmpColor);
  }
}
