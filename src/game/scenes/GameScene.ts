import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { BALANCE, type RuntimeStats } from "../config/balance";
import { Coin } from "../entities/Coin";
import { GrassClippings } from "../entities/GrassClippings";
import { GrassField } from "../entities/GrassField";
import { Player } from "../entities/Player";
import {
  advanceChargeAttack,
  getSurvivingHitIds,
  type ChargeAttackState,
  resolveAttack,
} from "../systems/AttackSystem";
import { cloneModel } from "../assets/models";
import { rewardForGrass } from "../systems/EconomySystem";
import { createGrassBatch, createGrassState, randomGrassPosition } from "../systems/GrassSystem";
import { InputSystem, mapScreenInputToWorldMovement } from "../systems/InputSystem";
import { addGold, getRuntimeStats, loadSave, saveGame } from "../systems/SaveSystem";
import { Hud } from "../ui/Hud";
import { VirtualJoystick } from "../ui/VirtualJoystick";
import type { GrassState } from "../types";

const ATTACK_FLASH_DURATION = 0.45;

export class GameScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly input = new InputSystem();
  private readonly hud: Hud;
  private readonly joystick: VirtualJoystick;
  private readonly player = new Player();
  private grassField!: GrassField;
  private readonly clippings = new GrassClippings();
  private readonly coins: Coin[] = [];
  private readonly stats: RuntimeStats;
  private readonly attackChargeGroup = new THREE.Group();
  private readonly attackRing: THREE.Mesh;
  private elapsedMs = 0;
  private chargeState: ChargeAttackState;
  private attackFlash = 0;
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
    this.attackRing = this.createIndicator();

    this.scene.background = new THREE.Color("#617075");
    this.scene.fog = new THREE.Fog("#617075", 12, 24);
    this.app.setOrthoSize(window.innerWidth < 760 ? 7.8 : 9.4);

    this.addLights();
    this.addMap();
    this.scene.add(this.player.group);
    this.scene.add(this.attackChargeGroup);
    this.grassField = new GrassField(this.stats.initialGrassCount + 64);
    this.scene.add(this.grassField.mesh);
    this.scene.add(this.clippings.mesh);
    this.spawnInitialGrass();
    this.updateInputMode();
    window.addEventListener("resize", this.updateInputMode);
  }

  update(deltaSeconds: number): void {
    this.updateCamera();
    this.player.update(deltaSeconds);
    this.updateGrass(deltaSeconds);
    this.updateCoins(deltaSeconds);
    this.clippings.update(deltaSeconds);
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

      if (charge.ready) {
        this.performAttack();
      }

      if (this.elapsedMs >= this.stats.roundDurationMs) {
        this.endRound();
      }
    }

    this.updateIndicator(deltaSeconds);

    this.hud.updateGame({
      timeMs: this.stats.roundDurationMs - this.elapsedMs,
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
    this.grassField.dispose();
    this.clippings.dispose();
    this.coins.forEach((coin) => coin.dispose());
    this.attackRing.geometry.dispose();
    (this.attackRing.material as THREE.Material).dispose();
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
    // Blender-authored 10x10 ground (mow stripes + sod edge); matches mapSizeMeters.
    this.scene.add(cloneModel("ground"));

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

  private createIndicator(): THREE.Mesh {
    // White outline ring matching the circular attack range. depthTest stays on
    // so the character occludes the portion of the ring drawn behind it.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2; // lay flat on the ground
    ring.position.y = 0.08;
    ring.renderOrder = 11;
    this.attackChargeGroup.add(ring);
    return ring;
  }

  private spawnInitialGrass(): void {
    const batch = createGrassBatch(this.stats.initialGrassCount, this.nextGrassId);
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
    this.grassField.add(state);
  }

  private performAttack(): void {
    this.attackFlash = 1; // flash the range ring on every strike
    const grassStates = this.grassField.getStates();
    const result = resolveAttack({
      origin: this.player.position,
      direction: this.player.direction,
      range: this.stats.attackRangeMeters,
      arcDegrees: this.stats.attackArcDegrees,
      damage: this.stats.attackDamage,
      grass: grassStates,
    });
    const positionById = new Map(grassStates.map((state) => [state.id, state.position]));
    const resultById = new Map(result.grass.map((state) => [state.id, state]));

    for (const id of result.hitIds) {
      const position = positionById.get(id);
      if (!position) {
        continue;
      }
      const screen = this.worldToScreen(new THREE.Vector3(position.x, 0.55, position.z));
      this.hud.spawnDamageText(screen.x, screen.y, this.stats.attackDamage);
    }

    for (const id of result.destroyedIds) {
      const position = positionById.get(id);
      if (!position) {
        continue;
      }
      const coin = new Coin(position);
      this.coins.push(coin);
      this.scene.add(coin.group);
      this.clippings.emit(position.x, position.z);
      this.grassField.destroy(id);
    }

    for (const id of getSurvivingHitIds(result)) {
      const state = resultById.get(id);
      if (state) {
        this.grassField.setHp(id, state.hp);
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
    this.grassField.update(deltaSeconds);
  }

  private updateIndicator(deltaSeconds: number): void {
    this.attackChargeGroup.position.set(this.player.position.x, 0, this.player.position.z);
    const range = this.stats.attackRangeMeters;
    this.attackRing.scale.set(range, range, 1);

    // Sit at 30% opacity, flash to 100% on a strike, then fade back.
    this.attackFlash = Math.max(0, this.attackFlash - deltaSeconds / ATTACK_FLASH_DURATION);
    (this.attackRing.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * this.attackFlash;
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
