import * as THREE from "three";
import type { VectorXZ } from "../types";

const MAX_PARTICLES = 800;
const SPAWN_PER_PATCH_PER_SEC = 9;
const MAX_SPAWN_PER_SEC = 120;

export class FireParticles {
  readonly mesh: THREE.Points;

  private readonly geo: THREE.BufferGeometry;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;

  // 각 슬롯의 상태 (typed array로 GC pressure 최소화)
  private readonly life    = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private readonly vx      = new Float32Array(MAX_PARTICLES);
  private readonly vy      = new Float32Array(MAX_PARTICLES);
  private readonly vz      = new Float32Array(MAX_PARTICLES);

  private active = 0;
  private spawnTimer = 0;
  private burning: readonly VectorXZ[] = [];

  constructor() {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color",    new THREE.BufferAttribute(this.col, 3));
    this.geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.mesh = new THREE.Points(this.geo, mat);
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
  }

  setBurning(positions: readonly VectorXZ[]): void {
    this.burning = positions;
  }

  update(dt: number): void {
    // ── 파티클 스폰 ──────────────────────────────────────────
    if (this.burning.length > 0) {
      const spawnRate = Math.min(this.burning.length * SPAWN_PER_PATCH_PER_SEC, MAX_SPAWN_PER_SEC);
      this.spawnTimer += dt;
      const toSpawn = Math.floor(this.spawnTimer * spawnRate);
      if (toSpawn > 0) {
        this.spawnTimer -= toSpawn / spawnRate;
        for (let s = 0; s < toSpawn && this.active < MAX_PARTICLES; s++) {
          const p = this.burning[Math.floor(Math.random() * this.burning.length)];
          const idx = this.active++;
          const i3 = idx * 3;
          this.pos[i3]     = p.x + (Math.random() - 0.5) * 0.16;
          this.pos[i3 + 1] = 0.05 + Math.random() * 0.18;
          this.pos[i3 + 2] = p.z + (Math.random() - 0.5) * 0.16;
          this.vx[idx]      = (Math.random() - 0.5) * 0.18;
          this.vy[idx]      = 0.45 + Math.random() * 0.65;
          this.vz[idx]      = (Math.random() - 0.5) * 0.18;
          this.life[idx]    = 0;
          this.maxLife[idx] = 0.35 + Math.random() * 0.55;
        }
      }
    } else {
      this.spawnTimer = 0;
    }

    // ── 파티클 업데이트 + 컴팩션 ────────────────────────────
    let w = 0;
    for (let i = 0; i < this.active; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) continue; // 수명 종료 → 슬롯 회수

      // 컴팩션 (앞쪽으로 이동)
      if (w !== i) {
        this.life[w]    = this.life[i];
        this.maxLife[w] = this.maxLife[i];
        this.vx[w]      = this.vx[i];
        this.vy[w]      = this.vy[i];
        this.vz[w]      = this.vz[i];
        const s3 = i * 3, d3 = w * 3;
        this.pos[d3]     = this.pos[s3];
        this.pos[d3 + 1] = this.pos[s3 + 1];
        this.pos[d3 + 2] = this.pos[s3 + 2];
      }

      const w3 = w * 3;
      this.pos[w3]     += this.vx[w] * dt;
      this.pos[w3 + 1] += this.vy[w] * dt;
      this.pos[w3 + 2] += this.vz[w] * dt;
      this.vy[w] *= (1 - dt * 1.8); // 감속

      // 색상: 밝은 노랑→주황→빨강으로 노화
      const t = this.life[w] / this.maxLife[w];
      this.col[w3]     = 1.0;
      this.col[w3 + 1] = Math.max(0, 0.7 - t * 1.1);
      this.col[w3 + 2] = Math.max(0, 0.15 - t * 0.3);

      w++;
    }
    this.active = w;

    this.geo.setDrawRange(0, this.active);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.PointsMaterial).dispose();
  }
}
