import * as THREE from "three";

const CAPACITY = 256; // pooled particles (ring buffer)
const PER_BURST = 5; // particles spawned per mowed clump
const GRAVITY = 7;
const COLORS = ["#4aa84f", "#3a8c42", "#69c46a"];

/**
 * Pooled grass-clipping particles rendered as one InstancedMesh. Each mowed
 * clump emits a short burst of small green bits that pop up, tumble, fall, and
 * shrink away. Inactive slots are scaled to zero (a ring buffer recycles them).
 */
export class GrassClippings {
  readonly mesh: THREE.InstancedMesh;
  private cursor = 0;

  private readonly px = new Float32Array(CAPACITY);
  private readonly py = new Float32Array(CAPACITY);
  private readonly pz = new Float32Array(CAPACITY);
  private readonly vx = new Float32Array(CAPACITY);
  private readonly vy = new Float32Array(CAPACITY);
  private readonly vz = new Float32Array(CAPACITY);
  private readonly rot = new Float32Array(CAPACITY * 3);
  private readonly spin = new Float32Array(CAPACITY * 3);
  private readonly age = new Float32Array(CAPACITY);
  private readonly life = new Float32Array(CAPACITY);
  private readonly baseScale = new Float32Array(CAPACITY);
  private readonly active = new Uint8Array(CAPACITY);

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    const geometry = new THREE.BoxGeometry(0.05, 0.015, 0.09);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const color = new THREE.Color();
    for (let i = 0; i < CAPACITY; i += 1) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.mesh.setColorAt(i, color.set(COLORS[i % COLORS.length]));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  emit(x: number, z: number): void {
    for (let n = 0; n < PER_BURST; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % CAPACITY;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.7 + Math.random() * 1.3;
      this.px[i] = x;
      this.py[i] = 0.25 + Math.random() * 0.15;
      this.pz[i] = z;
      this.vx[i] = Math.cos(angle) * speed;
      this.vz[i] = Math.sin(angle) * speed;
      this.vy[i] = 1.6 + Math.random() * 1.8;
      this.rot[i * 3] = Math.random() * Math.PI * 2;
      this.rot[i * 3 + 1] = Math.random() * Math.PI * 2;
      this.rot[i * 3 + 2] = Math.random() * Math.PI * 2;
      this.spin[i * 3] = (Math.random() * 2 - 1) * 12;
      this.spin[i * 3 + 1] = (Math.random() * 2 - 1) * 12;
      this.spin[i * 3 + 2] = (Math.random() * 2 - 1) * 12;
      this.age[i] = 0;
      this.life[i] = 0.5 + Math.random() * 0.25;
      this.baseScale[i] = 0.7 + Math.random() * 0.6;
      this.active[i] = 1;
    }
  }

  update(deltaSeconds: number): void {
    let changed = false;

    for (let i = 0; i < CAPACITY; i += 1) {
      if (!this.active[i]) {
        continue;
      }
      changed = true;
      this.age[i] += deltaSeconds;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.active[i] = 0;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }

      this.vy[i] -= GRAVITY * deltaSeconds;
      this.px[i] += this.vx[i] * deltaSeconds;
      this.py[i] += this.vy[i] * deltaSeconds;
      this.pz[i] += this.vz[i] * deltaSeconds;
      if (this.py[i] < 0.02) {
        this.py[i] = 0.02;
        this.vy[i] = 0;
        this.vx[i] *= 0.6;
        this.vz[i] *= 0.6;
      }
      this.rot[i * 3] += this.spin[i * 3] * deltaSeconds;
      this.rot[i * 3 + 1] += this.spin[i * 3 + 1] * deltaSeconds;
      this.rot[i * 3 + 2] += this.spin[i * 3 + 2] * deltaSeconds;

      const s = this.baseScale[i] * Math.max(0, 1 - t);
      this.e.set(this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2]);
      this.q.setFromEuler(this.e);
      this.pos.set(this.px[i], this.py[i], this.pz[i]);
      this.scl.set(s, s, s);
      this.m.compose(this.pos, this.q, this.scl);
      this.mesh.setMatrixAt(i, this.m);
    }

    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
