import * as THREE from "three";
import type { VectorXZ } from "../types";
import { cloneModel } from "../assets/models";
import { resolveCollision, type Circle } from "../systems/ObstacleSystem";

const PLAYER_COLLISION_RADIUS = 0.18;
const KNOCKBACK_TAU = 0.12; // exponential decay time of the recoil shove

export class Player {
  readonly group = new THREE.Group();
  readonly position: VectorXZ = { x: 0, z: 0 };
  readonly direction: VectorXZ = { x: 1, z: 0 };
  private readonly tool = new THREE.Group();
  private strikeTimer = 0;
  private stunTimer = 0;
  private knockX = 0;
  private knockZ = 0;
  // Cloned-per-instance materials so the stun "red flash" never leaks into the
  // shared model cache (the menu preview builds its own Player too).
  private readonly tintMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly baseEmissive: THREE.Color[] = [];
  private readonly baseEmissiveIntensity: number[] = [];
  private tinted = false;

  constructor() {
    this.group.name = "Player";

    const body = cloneModel("farmer");
    this.group.add(body);

    // Korean hand sickle, held in the right hand (+Z side) at hip height and
    // swung on strike(). The model's handle runs along +X (the character's
    // forward axis), so identity rotation points it toward the front.
    const sickle = cloneModel("sickle");
    sickle.rotation.set(0, 0, 0);
    this.tool.add(sickle);
    this.tool.position.set(0.12, 0.42, 0.08);
    this.tool.scale.setScalar(0.8);
    this.group.add(this.tool);

    this.cloneMaterials();
    this.syncTransform();
  }

  get stunned(): boolean {
    return this.stunTimer > 0;
  }

  /** Lock out movement and attacks for `seconds` (recoil from a failed chop). */
  stun(seconds: number): void {
    this.stunTimer = Math.max(this.stunTimer, seconds);
  }

  /** Shove the player along (dirX, dirZ) at `speed` m/s; decays away quickly. */
  applyKnockback(dirX: number, dirZ: number, speed: number): void {
    const length = Math.hypot(dirX, dirZ) || 1;
    this.knockX = (dirX / length) * speed;
    this.knockZ = (dirZ / length) * speed;
  }

  move(vector: VectorXZ, speed: number, deltaSeconds: number, mapSize: number, blockers: readonly Circle[] = []): void {
    const half = mapSize / 2 - 0.24;
    let x = this.position.x;
    let z = this.position.z;

    // Knockback always applies, even while stunned (this is the recoil shove).
    if (this.knockX !== 0 || this.knockZ !== 0) {
      x += this.knockX * deltaSeconds;
      z += this.knockZ * deltaSeconds;
      const decay = Math.exp(-deltaSeconds / KNOCKBACK_TAU);
      this.knockX *= decay;
      this.knockZ *= decay;
      if (Math.hypot(this.knockX, this.knockZ) < 0.05) {
        this.knockX = 0;
        this.knockZ = 0;
      }
    }

    // Input is ignored while dazed.
    if (!this.stunned) {
      if (Math.hypot(vector.x, vector.z) > 0) {
        this.direction.x = vector.x;
        this.direction.z = vector.z;
      }
      x += vector.x * speed * deltaSeconds;
      z += vector.z * speed * deltaSeconds;
    }

    x = THREE.MathUtils.clamp(x, -half, half);
    z = THREE.MathUtils.clamp(z, -half, half);

    // Slide out of intact rocks/trees, then re-clamp in case a push left the map.
    const resolved = resolveCollision({ x, z }, blockers, PLAYER_COLLISION_RADIUS);
    this.position.x = THREE.MathUtils.clamp(resolved.x, -half, half);
    this.position.z = THREE.MathUtils.clamp(resolved.z, -half, half);
    this.syncTransform();
  }

  strike(): void {
    this.strikeTimer = 0.18;
  }

  update(deltaSeconds: number): void {
    this.strikeTimer = Math.max(0, this.strikeTimer - deltaSeconds);
    const strikeProgress = this.strikeTimer > 0 ? this.strikeTimer / 0.18 : 0;
    this.tool.rotation.y = -Math.sin((1 - strikeProgress) * Math.PI) * 1.3;
    this.tool.rotation.z = Math.sin((1 - strikeProgress) * Math.PI) * 0.28;

    this.stunTimer = Math.max(0, this.stunTimer - deltaSeconds);
    // Dizzy wobble + pulsing red glow while stunned, then settle and clear.
    if (this.stunned) {
      this.group.rotation.z = Math.sin(this.stunTimer * 22) * 0.18;
      const blink = 0.5 + 0.5 * Math.sin(this.stunTimer * 26);
      this.setTint(true, 0.4 + blink * 1.0);
      this.tinted = true;
    } else if (this.tinted) {
      this.group.rotation.z = 0;
      this.setTint(false, 0);
      this.tinted = false;
    }
  }

  private cloneMaterials(): void {
    this.group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = materials.map((material) => material.clone());
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      for (const material of cloned) {
        const standard = material as THREE.MeshStandardMaterial;
        if (standard.emissive) {
          this.tintMaterials.push(standard);
          this.baseEmissive.push(standard.emissive.clone());
          this.baseEmissiveIntensity.push(standard.emissiveIntensity);
        }
      }
    });
  }

  private setTint(on: boolean, intensity: number): void {
    for (let index = 0; index < this.tintMaterials.length; index += 1) {
      const material = this.tintMaterials[index];
      if (on) {
        material.emissive.setRGB(0.9, 0.05, 0.05);
        material.emissiveIntensity = intensity;
      } else {
        material.emissive.copy(this.baseEmissive[index]);
        material.emissiveIntensity = this.baseEmissiveIntensity[index];
      }
    }
  }

  private syncTransform(): void {
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = -Math.atan2(this.direction.z, this.direction.x);
  }
}
