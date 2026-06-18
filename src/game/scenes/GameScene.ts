import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { BALANCE, type RuntimeStats } from "../config/balance";
import { Coin } from "../entities/Coin";
import { Grass } from "../entities/Grass";
import { Player } from "../entities/Player";
import {
  advanceChargeAttack,
  createAttackFanGeometry,
  getSurvivingHitIds,
  type ChargeAttackState,
  resolveAttack,
} from "../systems/AttackSystem";
import { rewardForGrass } from "../systems/EconomySystem";
import { createGrassBatch, createGrassState, randomGrassPosition } from "../systems/GrassSystem";
import { InputSystem, mapScreenInputToWorldMovement } from "../systems/InputSystem";
import { addGold, getRuntimeStats, loadSave, saveGame } from "../systems/SaveSystem";
import { Hud } from "../ui/Hud";
import { VirtualJoystick } from "../ui/VirtualJoystick";
import type { GrassState, VectorXZ } from "../types";

export class GameScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly input = new InputSystem();
  private readonly hud: Hud;
  private readonly joystick: VirtualJoystick;
  private readonly player = new Player();
  private readonly grass = new Map<string, Grass>();
  private readonly coins: Coin[] = [];
  private readonly stats: RuntimeStats;
  private readonly attackChargeGroup = new THREE.Group();
  private readonly attackChargeBase: THREE.Mesh;
  private readonly attackChargeFill: THREE.Mesh;
  private elapsedMs = 0;
  private chargeState: ChargeAttackState;
  private attackChargeProgress = 0;
  private spawnTimerMs = 0;
  private roundGold = 0;
  private nextGrassId = 1;
  private ended = false;
  private save = loadSave();
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0);

  constructor(private readonly app: App) {
    this.stats = getRuntimeStats(this.save);
    this.hud = new Hud(this.app.uiRoot);
    this.joystick = new VirtualJoystick(this.app.uiRoot, (vector) => this.input.setJoystickVector(vector));
    this.chargeState = { elapsedMs: 0, durationMs: this.stats.attackChargeDurationMs };
    const chargeMeshes = this.createAttackCharge();
    this.attackChargeBase = chargeMeshes.base;
    this.attackChargeFill = chargeMeshes.fill;

    this.scene.background = new THREE.Color("#617075");
    this.scene.fog = new THREE.Fog("#617075", 12, 24);
    this.app.setOrthoSize(window.innerWidth < 760 ? 7.8 : 9.4);

    this.addLights();
    this.addMap();
    this.scene.add(this.player.group);
    this.scene.add(this.attackChargeGroup);
    this.spawnInitialGrass();
    this.updateInputMode();
    window.addEventListener("resize", this.updateInputMode);
  }

  update(deltaSeconds: number): void {
    this.updateCamera();
    this.player.update(deltaSeconds);
    this.updateGrass(deltaSeconds);
    this.updateCoins(deltaSeconds);
    this.hud.update(deltaSeconds);

    if (!this.ended) {
      this.elapsedMs += deltaSeconds * 1000;
      if (this.stats.grassSpawnPerTick > 0) {
        this.spawnTimerMs += deltaSeconds * 1000;

        while (this.spawnTimerMs >= this.stats.grassSpawnIntervalMs) {
          this.spawnTimerMs -= this.stats.grassSpawnIntervalMs;
          this.spawnGrass(this.stats.grassSpawnPerTick);
        }
      }

      const movement = mapScreenInputToWorldMovement(this.input.getMovementVector());
      this.player.move(movement, this.stats.moveSpeed, deltaSeconds, BALANCE.mapSizeMeters);

      const charge = advanceChargeAttack(this.chargeState, deltaSeconds * 1000);
      this.chargeState = charge.state;
      this.attackChargeProgress = charge.progress;

      if (charge.ready) {
        this.performAttack();
      }

      if (this.elapsedMs >= BALANCE.roundDurationMs) {
        this.endRound();
      }
    }

    this.updateAttackCharge();

    this.hud.updateGame({
      timeMs: BALANCE.roundDurationMs - this.elapsedMs,
      roundGold: this.roundGold,
      totalGold: this.save.totalGold + this.roundGold,
      damage: this.stats.attackDamage,
      attackIntervalMs: this.stats.attackChargeDurationMs,
      range: this.stats.attackRangeMeters,
    });
  }

  dispose(): void {
    window.removeEventListener("resize", this.updateInputMode);
    this.input.dispose();
    this.joystick.dispose();
    this.hud.dispose();
    this.grass.forEach((grass) => grass.dispose());
    this.coins.forEach((coin) => coin.dispose());
    for (const mesh of [this.attackChargeBase, this.attackChargeFill]) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight("#f4f9e8", "#3d4a52", 1.55));
    const sun = new THREE.DirectionalLight("#ffe7b0", 2.15);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 20;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    this.scene.add(sun);
  }

  private addMap(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(BALANCE.mapSizeMeters, BALANCE.mapSizeMeters),
      new THREE.MeshStandardMaterial({ color: "#497f49", roughness: 0.94 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(BALANCE.mapSizeMeters, 10, "#263239", "#5d6f4f");
    grid.position.y = 0.012;
    this.scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: "#38424a", roughness: 0.88 });
    for (const offset of [-2, 2]) {
      const roadX = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, BALANCE.mapSizeMeters), roadMaterial);
      roadX.position.set(offset, 0.02, 0);
      roadX.receiveShadow = true;
      this.scene.add(roadX);

      const roadZ = new THREE.Mesh(new THREE.BoxGeometry(BALANCE.mapSizeMeters, 0.02, 0.18), roadMaterial);
      roadZ.position.set(0, 0.021, offset);
      roadZ.receiveShadow = true;
      this.scene.add(roadZ);
    }

    const half = BALANCE.mapSizeMeters / 2;
    const points = [
      new THREE.Vector3(-half, 0.04, -half),
      new THREE.Vector3(half, 0.04, -half),
      new THREE.Vector3(half, 0.04, half),
      new THREE.Vector3(-half, 0.04, half),
      new THREE.Vector3(-half, 0.04, -half),
    ];
    const border = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: "#f0d786", linewidth: 2 }),
    );
    this.scene.add(border);
  }

  private createAttackCharge(): { base: THREE.Mesh; fill: THREE.Mesh } {
    const base = new THREE.Mesh(
      createAttackFanGeometry(this.stats.attackArcDegrees),
      new THREE.MeshBasicMaterial({
        color: "#54110f",
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const fill = new THREE.Mesh(
      createAttackFanGeometry(this.stats.attackArcDegrees),
      new THREE.MeshBasicMaterial({
        color: "#ff2f24",
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    base.position.y = 0.045;
    fill.position.y = 0.047;
    this.attackChargeGroup.add(base, fill);
    return { base, fill };
  }

  private spawnInitialGrass(): void {
    const starterClump: VectorXZ[] = [
      { x: 0.36, z: 0 },
      { x: 0.42, z: 0.14 },
      { x: 0.42, z: -0.14 },
    ];

    for (const position of starterClump) {
      this.addGrassState(createGrassState(`grass-${this.nextGrassId}`, position));
      this.nextGrassId += 1;
    }

    const batch = createGrassBatch(this.stats.initialGrassCount, this.nextGrassId, this.player.position);
    this.nextGrassId += batch.length;
    for (const state of batch) {
      this.addGrassState(state);
    }
  }

  private spawnGrass(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.addGrassState(
        createGrassState(`grass-${this.nextGrassId}`, randomGrassPosition(BALANCE.mapSizeMeters, this.player.position)),
      );
      this.nextGrassId += 1;
    }
  }

  private addGrassState(state: GrassState): void {
    const grass = new Grass(state);
    this.grass.set(state.id, grass);
    this.scene.add(grass.group);
  }

  private performAttack(): void {
    const grassStates = Array.from(this.grass.values()).map((grass) => grass.state);
    const result = resolveAttack({
      origin: this.player.position,
      direction: this.player.direction,
      range: this.stats.attackRangeMeters,
      arcDegrees: this.stats.attackArcDegrees,
      damage: this.stats.attackDamage,
      grass: grassStates,
    });
    const resultById = new Map(result.grass.map((state) => [state.id, state]));

    for (const id of result.hitIds) {
      const grass = this.grass.get(id);
      if (!grass) {
        continue;
      }

      const screen = this.worldToScreen(new THREE.Vector3(grass.state.position.x, 0.55, grass.state.position.z));
      this.hud.spawnDamageText(screen.x, screen.y, this.stats.attackDamage);
    }

    for (const id of result.destroyedIds) {
      const grass = this.grass.get(id);
      if (!grass) {
        continue;
      }

      const coin = new Coin(grass.state.position);
      this.coins.push(coin);
      this.scene.add(coin.group);
      this.scene.remove(grass.group);
      grass.dispose();
      this.grass.delete(id);
    }

    for (const id of getSurvivingHitIds(result)) {
      const grass = this.grass.get(id);
      const state = resultById.get(id);

      if (grass && state) {
        grass.setHp(state.hp);
      }
    }

    if (result.hitIds.length > 0) {
      this.player.strike();
    }

    this.roundGold += rewardForGrass(this.stats, result.destroyedIds.length);
  }

  private updateCoins(deltaSeconds: number): void {
    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      const coin = this.coins[index];

      if (coin.update(deltaSeconds)) {
        this.scene.remove(coin.group);
        coin.dispose();
        this.coins.splice(index, 1);
      }
    }
  }

  private updateGrass(deltaSeconds: number): void {
    this.grass.forEach((grass) => grass.update(deltaSeconds));
  }

  private updateAttackCharge(): void {
    this.attackChargeGroup.position.set(this.player.position.x, 0, this.player.position.z);
    this.attackChargeGroup.rotation.y = -Math.atan2(this.player.direction.z, this.player.direction.x);
    this.attackChargeBase.scale.set(this.stats.attackRangeMeters, 1, this.stats.attackRangeMeters);
    this.attackChargeFill.scale.set(
      Math.max(0.02, this.stats.attackRangeMeters * this.attackChargeProgress),
      1,
      Math.max(0.02, this.stats.attackRangeMeters * this.attackChargeProgress),
    );
  }

  private updateCamera(): void {
    this.cameraTarget.set(this.player.position.x, 0, this.player.position.z);
    const offset = new THREE.Vector3(5.8, 6.2, 5.8);
    this.app.camera.position.copy(this.cameraTarget).add(offset);
    this.app.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
  }

  private worldToScreen(position: THREE.Vector3): { x: number; y: number } {
    const projected = position.clone().project(this.app.camera);

    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  private endRound(): void {
    this.ended = true;
    this.save = addGold(this.save, this.roundGold);
    saveGame(this.save);
    this.joystick.setVisible(false);
    this.hud.showResult(this.roundGold, {
      onRetry: () => this.app.show("game"),
      onSkills: () => this.app.show("skills"),
      onMenu: () => this.app.show("menu"),
    });
  }

  private readonly updateInputMode = (): void => {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const useJoystick = coarsePointer || window.innerWidth <= 760;
    this.joystick.setVisible(!this.ended && useJoystick);
  };
}
