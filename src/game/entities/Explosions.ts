import * as THREE from "three";

const DEBRIS_CAPACITY = 384; // pooled debris chunks (ring buffer)
const DEBRIS_PER_BURST = 24;
const GRAVITY = 10;
const DEBRIS_COLORS = ["#ff7a18", "#ffb347", "#ffd84a", "#5b554f", "#262320"];

const RING_CAPACITY = 12; // pooled shockwave rings

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  maxRadius: number;
  startOpacity: number;
  active: boolean;
}

/**
 * Pooled explosion VFX as one group: a burst of debris chunks (one InstancedMesh,
 * ring-buffer recycled) plus expanding shockwave rings that fade as they reach the
 * blast radius. `emit(x, z, radius)` fires both. No per-explosion allocation.
 */
export class Explosions {
  readonly group = new THREE.Group();
  private readonly debris: THREE.InstancedMesh;
  private readonly ringGeometry = new THREE.RingGeometry(0.72, 1, 48);
  private cursor = 0;

  private readonly px = new Float32Array(DEBRIS_CAPACITY);
  private readonly py = new Float32Array(DEBRIS_CAPACITY);
  private readonly pz = new Float32Array(DEBRIS_CAPACITY);
  private readonly vx = new Float32Array(DEBRIS_CAPACITY);
  private readonly vy = new Float32Array(DEBRIS_CAPACITY);
  private readonly vz = new Float32Array(DEBRIS_CAPACITY);
  private readonly rot = new Float32Array(DEBRIS_CAPACITY * 3);
  private readonly spin = new Float32Array(DEBRIS_CAPACITY * 3);
  private readonly age = new Float32Array(DEBRIS_CAPACITY);
  private readonly life = new Float32Array(DEBRIS_CAPACITY);
  private readonly baseScale = new Float32Array(DEBRIS_CAPACITY);
  private readonly active = new Uint8Array(DEBRIS_CAPACITY);

  private readonly rings: Ring[] = [];
  private ringCursor = 0;

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    const geometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.85, emissiveIntensity: 0.6 });
    this.debris = new THREE.InstancedMesh(geometry, material, DEBRIS_CAPACITY);
    this.debris.castShadow = false;
    this.debris.receiveShadow = false;
    this.debris.frustumCulled = false;
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const color = new THREE.Color();
    for (let i = 0; i < DEBRIS_CAPACITY; i += 1) {
      this.debris.setMatrixAt(i, this.hidden);
      this.debris.setColorAt(i, color.set(DEBRIS_COLORS[i % DEBRIS_COLORS.length]));
    }
    this.debris.instanceMatrix.needsUpdate = true;
    if (this.debris.instanceColor) {
      this.debris.instanceColor.needsUpdate = true;
    }
    this.group.add(this.debris);

    for (let i = 0; i < RING_CAPACITY; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: "#ffb347",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.ringGeometry, material);
      mesh.rotation.x = -Math.PI / 2; // lay flat on the ground
      mesh.position.y = 0.06;
      mesh.visible = false;
      mesh.renderOrder = 12;
      this.group.add(mesh);
      this.rings.push({ mesh, material, age: 0, life: 0, maxRadius: 0, startOpacity: 0, active: false });
    }
  }

  /** Fire an explosion: debris burst + a fast flash ring and a slower shock ring. */
  emit(x: number, z: number, radius: number): void {
    this.spawnDebris(x, z, radius);
    this.spawnRing(x, z, radius * 0.5, 0.18, "#fff1c4", 0.85); // flash
    this.spawnRing(x, z, radius, 0.5, "#ff8a2a", 0.6); // shockwave
  }

  private spawnDebris(x: number, z: number, radius: number): void {
    // Horizontal spread scales with the blast radius (tuned so radius 5 keeps
    // the original feel); vertical pop stays fixed so chunks always arc up.
    for (let n = 0; n < DEBRIS_PER_BURST; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % DEBRIS_CAPACITY;

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.45 + Math.random() * 0.65) * radius;
      this.px[i] = x;
      this.py[i] = 0.3 + Math.random() * 0.3;
      this.pz[i] = z;
      this.vx[i] = Math.cos(angle) * speed;
      this.vz[i] = Math.sin(angle) * speed;
      this.vy[i] = 2.6 + Math.random() * 3.4;
      this.rot[i * 3] = Math.random() * Math.PI * 2;
      this.rot[i * 3 + 1] = Math.random() * Math.PI * 2;
      this.rot[i * 3 + 2] = Math.random() * Math.PI * 2;
      this.spin[i * 3] = (Math.random() * 2 - 1) * 16;
      this.spin[i * 3 + 1] = (Math.random() * 2 - 1) * 16;
      this.spin[i * 3 + 2] = (Math.random() * 2 - 1) * 16;
      this.age[i] = 0;
      this.life[i] = 0.55 + Math.random() * 0.35;
      this.baseScale[i] = 0.7 + Math.random() * 0.9;
      this.active[i] = 1;
    }
  }

  private spawnRing(x: number, z: number, maxRadius: number, life: number, color: string, opacity: number): void {
    const ring = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % RING_CAPACITY;
    ring.material.color.set(color);
    ring.material.opacity = opacity;
    ring.startOpacity = opacity;
    ring.age = 0;
    ring.life = life;
    ring.maxRadius = maxRadius;
    ring.active = true;
    ring.mesh.visible = true;
    ring.mesh.position.set(x, 0.06, z);
    ring.mesh.scale.set(0.001, 0.001, 0.001);
  }

  update(deltaSeconds: number): void {
    let changed = false;

    for (let i = 0; i < DEBRIS_CAPACITY; i += 1) {
      if (!this.active[i]) {
        continue;
      }
      changed = true;
      this.age[i] += deltaSeconds;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.active[i] = 0;
        this.debris.setMatrixAt(i, this.hidden);
        continue;
      }

      this.vy[i] -= GRAVITY * deltaSeconds;
      this.px[i] += this.vx[i] * deltaSeconds;
      this.py[i] += this.vy[i] * deltaSeconds;
      this.pz[i] += this.vz[i] * deltaSeconds;
      if (this.py[i] < 0.02) {
        this.py[i] = 0.02;
        this.vy[i] *= -0.35;
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
      this.debris.setMatrixAt(i, this.m);
    }

    if (changed) {
      this.debris.instanceMatrix.needsUpdate = true;
    }

    for (const ring of this.rings) {
      if (!ring.active) {
        continue;
      }
      ring.age += deltaSeconds;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        ring.material.opacity = 0;
        continue;
      }
      const eased = 1 - (1 - t) * (1 - t); // ease-out toward the blast radius
      const r = Math.max(0.001, ring.maxRadius * eased);
      ring.mesh.scale.set(r, r, r);
      ring.material.opacity = ring.startOpacity * (1 - t);
    }
  }

  dispose(): void {
    this.debris.geometry.dispose();
    (this.debris.material as THREE.Material).dispose();
    this.debris.dispose();
    for (const ring of this.rings) {
      ring.material.dispose();
    }
    this.ringGeometry.dispose();
  }
}
