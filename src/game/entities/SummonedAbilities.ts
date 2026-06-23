import * as THREE from "three";
import type { VectorXZ } from "../types";
import type { RuntimeStats, SummonAbilityId } from "../systems/CardEffectSystem";

/** A grass-cutting footprint produced by an ability during a single frame. */
export interface SummonCut {
  x: number;
  z: number;
  radius: number;
  damage: number;
  ignite: boolean;
}

export interface SummonCtx {
  playerPos: VectorXZ;
  playerDir: VectorXZ;
  playerDamage: number;
  playerRange: number;
  mapSize: number;
}

interface SummonEntity {
  readonly group: THREE.Group;
  update(dt: number, ctx: SummonCtx): { done: boolean; cuts: SummonCut[] };
  dispose(): void;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}

function randomEdgeCrossing(mapSize: number): { start: VectorXZ; dir: VectorXZ; length: number } {
  const half = mapSize / 2;
  const horizontal = Math.random() < 0.5;
  if (horizontal) {
    const z = (Math.random() - 0.5) * mapSize;
    const leftToRight = Math.random() < 0.5;
    return {
      start: { x: leftToRight ? -half : half, z },
      dir: { x: leftToRight ? 1 : -1, z: 0 },
      length: mapSize,
    };
  }
  const x = (Math.random() - 0.5) * mapSize;
  const topToBottom = Math.random() < 0.5;
  return {
    start: { x, z: topToBottom ? -half : half },
    dir: { x: 0, z: topToBottom ? 1 : -1 },
    length: mapSize,
  };
}

// ─── Shadow Clone ──────────────────────────────────────────────────────────
const CLONE_LIFE = 2.2;
const CLONE_FADE = 0.25;
const CLONE_SWING_INTERVAL = 0.4;

class ShadowClone implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly bodyMat: THREE.MeshBasicMaterial;
  private age = 0;
  private swingTimer = 0;

  constructor(private readonly pos: VectorXZ, private readonly radius: number, private readonly damage: number) {
    this.bodyMat = new THREE.MeshBasicMaterial({ color: "#17141f", transparent: true, opacity: 0, depthWrite: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.5, 12), this.bodyMat);
    body.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.bodyMat);
    head.position.y = 0.68;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.9, radius, 32),
      new THREE.MeshBasicMaterial({ color: "#7a5cff", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    this.group.add(body, head, ring);
    this.group.position.set(pos.x, 0, pos.z);
  }

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    this.age += dt;
    const fadeIn = Math.min(1, this.age / CLONE_FADE);
    const fadeOut = Math.min(1, Math.max(0, (CLONE_LIFE - this.age) / CLONE_FADE));
    this.bodyMat.opacity = 0.6 * fadeIn * fadeOut;
    this.group.rotation.y += dt * 3;

    const cuts: SummonCut[] = [];
    if (this.age > CLONE_FADE && this.age < CLONE_LIFE - CLONE_FADE) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.swingTimer = CLONE_SWING_INTERVAL;
        cuts.push({ x: this.pos.x, z: this.pos.z, radius: this.radius, damage: this.damage, ignite: false });
      }
    }
    return { done: this.age >= CLONE_LIFE, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Flying Scythe ─────────────────────────────────────────────────────────
const SCYTHE_FLY_SPEED = 5.5;
const SCYTHE_SPIN_TIME = 0.16; // seconds per rotation
const SCYTHE_PULSE = 0.1;

function makeBlade(color = "#e8eef3"): THREE.Mesh {
  const blade = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.05, 6, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  blade.rotation.x = -Math.PI / 2;
  blade.position.y = 0.3;
  return blade;
}

class FlyingScythe implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly blade: THREE.Mesh;
  private readonly dir: VectorXZ;
  private traveled = 0;
  private spinElapsed = 0;
  private pulse = 0;
  private phase: "fly" | "spin" | "done" = "fly";
  private fade = 1;

  constructor(
    origin: VectorXZ,
    angleOffsetRad: number,
    baseDir: VectorXZ,
    private readonly stopDistance: number,
    private readonly radius: number,
    spins: number,
    private readonly damage: number,
  ) {
    const baseAngle = Math.atan2(baseDir.z, baseDir.x) + angleOffsetRad;
    this.dir = { x: Math.cos(baseAngle), z: Math.sin(baseAngle) };
    this.spinDuration = Math.max(0.2, spins * SCYTHE_SPIN_TIME);
    this.blade = makeBlade();
    this.group.add(this.blade);
    this.group.position.set(origin.x, 0, origin.z);
  }

  private readonly spinDuration: number;

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    const cuts: SummonCut[] = [];
    this.blade.rotation.z += dt * 40;

    if (this.phase === "fly") {
      const step = SCYTHE_FLY_SPEED * dt;
      this.traveled += step;
      this.group.position.x += this.dir.x * step;
      this.group.position.z += this.dir.z * step;
      this.pulse -= dt;
      if (this.pulse <= 0) {
        this.pulse = SCYTHE_PULSE;
        cuts.push({ x: this.group.position.x, z: this.group.position.z, radius: this.radius * 0.7, damage: this.damage, ignite: false });
      }
      if (this.traveled >= this.stopDistance) this.phase = "spin";
    } else if (this.phase === "spin") {
      this.spinElapsed += dt;
      this.pulse -= dt;
      if (this.pulse <= 0) {
        this.pulse = SCYTHE_PULSE;
        cuts.push({ x: this.group.position.x, z: this.group.position.z, radius: this.radius, damage: this.damage, ignite: false });
      }
      if (this.spinElapsed >= this.spinDuration) this.phase = "done";
    } else {
      this.fade -= dt * 4;
      (this.blade.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.fade);
    }

    return { done: this.phase === "done" && this.fade <= 0, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Boomerang Scythe ──────────────────────────────────────────────────────
const BOOMERANG_SPEED = 6.5;
const BOOMERANG_PULSE = 0.09;

class Boomerang implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly blade: THREE.Mesh;
  private readonly dir: VectorXZ;
  private traveled = 0;
  private pulse = 0;
  private phase: "out" | "back" = "out";

  constructor(
    private readonly origin: VectorXZ,
    angleOffsetRad: number,
    baseDir: VectorXZ,
    private readonly range: number,
    private readonly radius: number,
    private readonly damage: number,
  ) {
    const baseAngle = Math.atan2(baseDir.z, baseDir.x) + angleOffsetRad;
    this.dir = { x: Math.cos(baseAngle), z: Math.sin(baseAngle) };
    this.blade = makeBlade("#ffd36b");
    this.group.add(this.blade);
    this.group.position.set(origin.x, 0, origin.z);
  }

  update(dt: number, ctx: SummonCtx): { done: boolean; cuts: SummonCut[] } {
    const cuts: SummonCut[] = [];
    this.blade.rotation.z += dt * 38;
    const step = BOOMERANG_SPEED * dt;

    if (this.phase === "out") {
      this.traveled += step;
      this.group.position.x += this.dir.x * step;
      this.group.position.z += this.dir.z * step;
      if (this.traveled >= this.range) this.phase = "back";
    } else {
      const toPlayer = { x: ctx.playerPos.x - this.group.position.x, z: ctx.playerPos.z - this.group.position.z };
      const dist = Math.hypot(toPlayer.x, toPlayer.z) || 1;
      this.group.position.x += (toPlayer.x / dist) * step;
      this.group.position.z += (toPlayer.z / dist) * step;
      if (dist <= step + 0.15) return { done: true, cuts };
    }

    this.pulse -= dt;
    if (this.pulse <= 0) {
      this.pulse = BOOMERANG_PULSE;
      cuts.push({ x: this.group.position.x, z: this.group.position.z, radius: this.radius, damage: this.damage, ignite: false });
    }
    return { done: false, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Tractor Summon ────────────────────────────────────────────────────────
const TRACTOR_SPEED = 5;

class TractorSummon implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly dir: VectorXZ;
  private traveled = 0;

  constructor(private readonly width: number, mapSize: number, private readonly damage: number) {
    const crossing = randomEdgeCrossing(mapSize);
    this.dir = crossing.dir;
    this.length = crossing.length;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, Math.max(0.6, width)),
      new THREE.MeshStandardMaterial({ color: "#d24a3a", roughness: 0.6 }),
    );
    body.position.y = 0.3;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, Math.max(0.4, width * 0.6)),
      new THREE.MeshStandardMaterial({ color: "#3a6ed2", roughness: 0.5 }),
    );
    cabin.position.set(-0.05, 0.55, 0);
    this.group.add(body, cabin);
    this.group.position.set(crossing.start.x, 0, crossing.start.z);
    this.group.rotation.y = -Math.atan2(this.dir.z, this.dir.x);
  }

  private readonly length: number;

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    const step = TRACTOR_SPEED * dt;
    this.traveled += step;
    this.group.position.x += this.dir.x * step;
    this.group.position.z += this.dir.z * step;
    const cuts: SummonCut[] = [
      { x: this.group.position.x, z: this.group.position.z, radius: this.width / 2, damage: this.damage, ignite: false },
    ];
    return { done: this.traveled >= this.length, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Lightning Strike ──────────────────────────────────────────────────────
const LIGHTNING_LIFE = 0.4;

class LightningStrike implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly boltMat: THREE.MeshBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private age = 0;
  private struck = false;

  constructor(private readonly pos: VectorXZ, private readonly radius: number, private readonly damage: number) {
    this.boltMat = new THREE.MeshBasicMaterial({ color: "#bfe4ff", transparent: true, opacity: 0.95, depthWrite: false });
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 3.2, 6), this.boltMat);
    bolt.position.y = 1.6;
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#ffe27a", transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.5, radius, 28), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.group.add(bolt, ring);
    this.group.position.set(pos.x, 0, pos.z);
  }

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    this.age += dt;
    const t = Math.min(1, this.age / LIGHTNING_LIFE);
    this.boltMat.opacity = 0.95 * (1 - t);
    this.ringMat.opacity = 0.7 * (1 - t);
    const cuts: SummonCut[] = [];
    if (!this.struck) {
      this.struck = true;
      cuts.push({ x: this.pos.x, z: this.pos.z, radius: this.radius, damage: this.damage, ignite: true });
    }
    return { done: this.age >= LIGHTNING_LIFE, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Drone ─────────────────────────────────────────────────────────────────
const DRONE_SPEED = 2.6;
const DRONE_PULSE = 0.14;
const DRONE_FADE = 0.3;

class Drone implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private target: VectorXZ;
  private age = 0;
  private pulse = 0;

  constructor(
    start: VectorXZ,
    private readonly radius: number,
    private readonly duration: number,
    private readonly mapSize: number,
    private readonly damage: number,
  ) {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: "#2b2f3a", roughness: 0.5, transparent: true, opacity: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), this.bodyMat);
    body.position.y = 1.3;
    this.beamMat = new THREE.MeshBasicMaterial({ color: "#7affd0", transparent: true, opacity: 0.3, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.3, 16, 1, true), this.beamMat);
    beam.position.y = 0.65;
    beam.rotation.x = Math.PI;
    this.group.add(body, beam);
    this.group.position.set(start.x, 0, start.z);
    this.target = this.randomTarget();
  }

  private randomTarget(): VectorXZ {
    const h = this.mapSize / 2 - 0.5;
    return { x: (Math.random() * 2 - 1) * h, z: (Math.random() * 2 - 1) * h };
  }

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    this.age += dt;
    const to = { x: this.target.x - this.group.position.x, z: this.target.z - this.group.position.z };
    const dist = Math.hypot(to.x, to.z);
    if (dist < 0.3) this.target = this.randomTarget();
    else {
      const step = DRONE_SPEED * dt;
      this.group.position.x += (to.x / dist) * step;
      this.group.position.z += (to.z / dist) * step;
    }

    const remaining = this.duration - this.age;
    if (remaining < DRONE_FADE) {
      const o = Math.max(0, remaining / DRONE_FADE);
      this.bodyMat.opacity = o;
      this.beamMat.opacity = 0.3 * o;
    }

    const cuts: SummonCut[] = [];
    this.pulse -= dt;
    if (this.pulse <= 0) {
      this.pulse = DRONE_PULSE;
      cuts.push({ x: this.group.position.x, z: this.group.position.z, radius: this.radius, damage: this.damage, ignite: false });
    }
    return { done: this.age >= this.duration, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Tornado ───────────────────────────────────────────────────────────────
const TORNADO_SPEED = 3.2;
const TORNADO_WEAVE = 2.2;

class Tornado implements SummonEntity {
  readonly group = new THREE.Group();
  private readonly rings: THREE.Mesh[] = [];
  private readonly dir: VectorXZ;
  private readonly perp: VectorXZ;
  private age = 0;
  private traveled = 0;

  constructor(
    private readonly size: number,
    private readonly duration: number,
    mapSize: number,
    private readonly damage: number,
  ) {
    const crossing = randomEdgeCrossing(mapSize);
    this.dir = crossing.dir;
    this.perp = { x: -this.dir.z, z: this.dir.x };
    this.maxTravel = crossing.length;
    for (let i = 0; i < 4; i += 1) {
      const r = size * (0.4 + i * 0.22);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.05, 6, 18),
        new THREE.MeshBasicMaterial({ color: "#cfd8e0", transparent: true, opacity: 0.5, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2 + i * 0.45;
      this.rings.push(ring);
      this.group.add(ring);
    }
    this.group.position.set(crossing.start.x, 0, crossing.start.z);
  }

  private readonly maxTravel: number;

  update(dt: number): { done: boolean; cuts: SummonCut[] } {
    this.age += dt;
    const step = TORNADO_SPEED * dt;
    this.traveled += step;
    const weave = Math.sin(this.age * 2.5) * TORNADO_WEAVE * dt;
    this.group.position.x += this.dir.x * step + this.perp.x * weave;
    this.group.position.z += this.dir.z * step + this.perp.z * weave;
    this.rings.forEach((ring, i) => { ring.rotation.z += dt * (8 + i * 3); });

    const cuts: SummonCut[] = [
      { x: this.group.position.x, z: this.group.position.z, radius: this.size, damage: this.damage, ignite: false },
    ];
    return { done: this.age >= this.duration || this.traveled >= this.maxTravel, cuts };
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

// ─── Manager ───────────────────────────────────────────────────────────────
/** Abilities that keep a steady on-field presence (spawn when active < count). */
const PRESENCE_ABILITIES: SummonAbilityId[] = ["shadowClone", "drone", "tornado", "tractorSummon"];

export class SummonSystem {
  readonly group = new THREE.Group();
  private readonly active = new Map<SummonAbilityId, SummonEntity[]>();
  private readonly timers = new Map<SummonAbilityId, number>();

  update(dt: number, ctx: SummonCtx, stats: RuntimeStats, paused: boolean): SummonCut[] {
    const cuts: SummonCut[] = [];

    for (const ability of Object.keys(stats.summons) as SummonAbilityId[]) {
      const runtime = stats.summons[ability];
      const list = this.active.get(ability) ?? [];

      // Advance existing entities (always, even when the round is over, so they
      // finish their animation and clean up).
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const result = list[i].update(dt, ctx);
        if (result.cuts.length > 0 && !paused) cuts.push(...result.cuts);
        if (result.done) {
          this.group.remove(list[i].group);
          list[i].dispose();
          list.splice(i, 1);
        }
      }
      this.active.set(ability, list);

      // Spawning only happens while the round is live and the ability is owned.
      if (paused || runtime.count <= 0) {
        continue;
      }
      let timer = this.timers.get(ability) ?? runtime.intervalSec;
      timer -= dt;
      if (timer <= 0) {
        timer += runtime.intervalSec;
        this.spawn(ability, runtime, ctx, list);
      }
      this.timers.set(ability, timer);
    }

    return cuts;
  }

  private add(ability: SummonAbilityId, list: SummonEntity[], entity: SummonEntity): void {
    list.push(entity);
    this.group.add(entity.group);
  }

  private spawn(
    ability: SummonAbilityId,
    runtime: RuntimeStats["summons"][SummonAbilityId],
    ctx: SummonCtx,
    list: SummonEntity[],
  ): void {
    const damage = ctx.playerDamage * runtime.damageFactor;
    const half = ctx.mapSize / 2 - 0.5;
    const randomPos = (): VectorXZ => ({ x: (Math.random() * 2 - 1) * half, z: (Math.random() * 2 - 1) * half });

    if (PRESENCE_ABILITIES.includes(ability) && list.length >= runtime.count) {
      return;
    }

    switch (ability) {
      case "shadowClone":
        this.add(ability, list, new ShadowClone(randomPos(), ctx.playerRange, damage));
        break;
      case "drone":
        this.add(ability, list, new Drone(randomPos(), runtime.radius, runtime.durationSec, ctx.mapSize, damage));
        break;
      case "tornado":
        this.add(ability, list, new Tornado(runtime.size, runtime.durationSec, ctx.mapSize, damage));
        break;
      case "tractorSummon":
        this.add(ability, list, new TractorSummon(runtime.width, ctx.mapSize, damage));
        break;
      case "flyingScythe":
        for (const angle of fanAngles(runtime.count)) {
          this.add(ability, list, new FlyingScythe(ctx.playerPos, angle, ctx.playerDir, runtime.range, runtime.radius, runtime.spins, damage));
        }
        break;
      case "boomerang":
        for (const angle of fanAngles(runtime.count)) {
          this.add(ability, list, new Boomerang(ctx.playerPos, angle, ctx.playerDir, runtime.range, runtime.radius, damage));
        }
        break;
      case "lightning":
        for (let i = 0; i < runtime.count; i += 1) {
          this.add(ability, list, new LightningStrike(randomPos(), runtime.radius, damage));
        }
        break;
    }
  }

  dispose(): void {
    for (const list of this.active.values()) {
      for (const entity of list) {
        this.group.remove(entity.group);
        entity.dispose();
      }
    }
    this.active.clear();
    this.timers.clear();
  }
}

/** Evenly spread `count` directions across a fan, centred on the base direction. */
function fanAngles(count: number): number[] {
  if (count <= 1) return [0];
  const spreadDeg = 20; // total ±10° per extra blade pair feel
  const total = THREE.MathUtils.degToRad(spreadDeg * (count - 1));
  const start = -total / 2;
  const stepRad = total / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * stepRad);
}
